const sql = require('mssql');
const config = require('../config');

class DatabaseService {
    constructor() {
        this.pool = null;
    }

    async connect() {
        try {
            if (this.pool) {
                await this.pool.close();
            }
            this.pool = await sql.connect(config.sql);
        } catch (err) {
            console.error('Database connection error:', err);
            throw err;
        }
    }

    async getParentProducts(quarter, year, manufacturer = null, productCategory = null) {
        try {
            if (!this.pool || !this.pool.connected) {
                await this.connect();
            }

            const quarterDates = this.getQuarterDates(quarter, year);
            
            const query = `
                SELECT DISTINCT 
                    p.kArtikel,
                    p.cArtNr,
                    p.cName,
                    p.fUVP,
                    p.fEKNetto,
                    p.dErscheinungsdatum as dErstellt,
                    p.kHersteller,
                    p.cHAN,
                    p.cHersteller as HerstellerName,
                    p.kWarengruppe,
                    p.fVKNetto as Preis,
                    l.fVerfuegbar as Lagerbestand,
                    (SELECT SUM(ISNULL(l2.fVerfuegbar, 0)) 
                     FROM vStandardArtikel child 
                     LEFT JOIN tLagerbestand l2 ON l2.kArtikel = child.kArtikel
                     WHERE child.kVaterArtikel = p.kArtikel) as ChildStock,
                    CAST(ROUND(((p.fUVP - p.fVKbrutto) / p.fUVP * 100), 0) as int) as Rabatt,
                    (SELECT TOP 1 bi.bBild 
                     FROM tArtikelBildPlattform bp 
                     JOIN tBild bi ON bi.kBild = bp.kBild 
                     WHERE bp.kArtikel = p.kArtikel 
                     AND bp.nNr = 1) as Produktbild
                FROM vStandardArtikel p
                LEFT JOIN tLagerbestand l ON l.kArtikel = p.kArtikel
                WHERE p.nIstVater = 1
                AND p.dErscheinungsdatum BETWEEN @startDate AND @endDate
                ${manufacturer ? 'AND p.kHersteller = @manufacturer' : ''}
                ${productCategory ? 'AND p.kWarengruppe = @productCategory' : ''}`;

            const request = this.pool.request()
                .input('startDate', sql.DateTime, quarterDates.start)
                .input('endDate', sql.DateTime, quarterDates.end);
            
            if (manufacturer) {
                request.input('manufacturer', sql.Int, manufacturer);
            }
            
            if (productCategory) {
                request.input('productCategory', sql.Int, productCategory);
            }

            const result = await request.query(query);
            return result.recordset;
        } catch (err) {
            console.error('Error fetching parent products:', err);
            throw err;
        }
    }

    async getChildProducts(parentId) {
        try {
            if (!this.pool || !this.pool.connected) {
                await this.connect();
            }

            const query = `
                SELECT DISTINCT 
                    a.kArtikel,
                    a.cArtNr,
                    a.cName,
                    a.fUVP,
                    a.fEKNetto,
                    a.dErscheinungsdatum as dErstellt,
                    a.fVKNetto as Preis,
                    l.fVerfuegbar as Lagerbestand,
                    CAST(ROUND(((a.fUVP - a.fVKbrutto) / a.fUVP * 100), 0) as int) as Rabatt
                FROM vStandardArtikel a
                LEFT JOIN tLagerbestand l ON l.kArtikel = a.kArtikel
                WHERE a.kVaterArtikel = @parentId`;

            const result = await this.pool.request()
                .input('parentId', sql.Int, parentId)
                .query(query);
            
            return result.recordset;
        } catch (err) {
            console.error('Error fetching child products:', err);
            throw err;
        }
    }

    async getSalesData(articleId) {
        try {
            if (!this.pool || !this.pool.connected) {
                await this.connect();
            }

            const query = `
                WITH ChildProducts AS (
                    SELECT kArtikel
                    FROM vStandardArtikel
                    WHERE kArtikel = @articleId
                    UNION ALL
                    SELECT a.kArtikel
                    FROM vStandardArtikel a
                    WHERE a.kVaterArtikel = @articleId
                )
                SELECT SUM(VAP.fAnzahl) as Gesamt
                FROM Verkauf.tAuftrag VA
                JOIN Verkauf.tAuftragPosition VAP ON VAP.kAuftrag = VA.kAuftrag
                JOIN ChildProducts CP ON VAP.kArtikel = CP.kArtikel
                WHERE VA.dErstellt >= DATEADD(MONTH, -3, GETDATE())
                AND VA.nStorno = 0
                AND VA.nType = 1`;

            const result = await this.pool.request()
                .input('articleId', sql.Int, articleId)
                .query(query);

            return result.recordset;
        } catch (err) {
            console.error('Error fetching sales data:', err);
            throw err;
        }
    }

    async getManufacturers() {
        try {
            if (!this.pool || !this.pool.connected) {
                await this.connect();
            }

            const query = `
                SELECT DISTINCT 
                    kHersteller,
                    cHersteller AS cName
                FROM vStandardArtikel
                WHERE nIstVater = 1
                ORDER BY cHersteller ASC`;

            const result = await this.pool.request().query(query);
            return result.recordset;
        } catch (err) {
            console.error('Error fetching manufacturers:', err);
            throw err;
        }
    }

    async getProductCategories() {
        try {
            if (!this.pool || !this.pool.connected) {
                await this.connect();
            }

            const query = `
                SELECT DISTINCT 
                    w.kWarengruppe,
                    w.cName
                FROM tWarengruppe w
                INNER JOIN vStandardArtikel a ON a.kWarengruppe = w.kWarengruppe
                WHERE a.nIstVater = 1`;

            const result = await this.pool.request().query(query);
            return result.recordset;
        } catch (err) {
            console.error('Error fetching product categories:', err);
            throw err;
        }
    }

    getQuarterDates(quarter, year) {
        const quarters = {
            'Q1': { start: `${year}-01-01`, end: `${year}-03-31` },
            'Q2': { start: `${year}-04-01`, end: `${year}-06-30` },
            'Q3': { start: `${year}-07-01`, end: `${year}-09-30` },
            'Q4': { start: `${year}-10-01`, end: `${year}-12-31` }
        };
        
        return {
            start: new Date(quarters[quarter].start),
            end: new Date(quarters[quarter].end)
        };
    }
}

module.exports = new DatabaseService();
