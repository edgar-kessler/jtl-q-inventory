const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

class DiscountManager {
    constructor() {
        // Warte auf DOM-Laden
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        // Hole DOM-Elemente
        this.discountModal = document.getElementById('discountModal');
        this.discountPercentInput = document.getElementById('discountPercent');
        this.applyDiscountBtn = document.getElementById('applyDiscount');
        this.cancelDiscountBtn = document.getElementById('cancelDiscount');
        this.confirmDiscountBtn = document.getElementById('confirmDiscount');
        this.cmdOutputWindow = document.getElementById('cmdOutputWindow');
        this.cmdOutputContent = document.getElementById('cmdOutputContent');
        this.closeCmdOutputBtn = document.getElementById('closeCmdOutput');

        if (!this.discountModal || !this.applyDiscountBtn) {
            console.error('Required elements not found:', {
                modal: !!this.discountModal,
                applyBtn: !!this.applyDiscountBtn
            });
            return;
        }
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        console.log('Setting up event listeners');
        this.applyDiscountBtn.addEventListener('click', () => {
            console.log('Apply discount clicked');
            this.showDiscountModal();
        });
        this.cancelDiscountBtn.addEventListener('click', () => this.hideDiscountModal());
        this.confirmDiscountBtn.addEventListener('click', () => this.processDiscount());
        this.closeCmdOutputBtn.addEventListener('click', () => this.hideCmdOutput());
    }

    showDiscountModal() {
        console.log('Showing modal');
        if (this.discountModal) {
            this.discountModal.classList.remove('hidden');
            this.discountModal.style.display = 'flex';
        }
    }

    hideDiscountModal() {
        if (this.discountModal) {
            this.discountModal.classList.add('hidden');
            this.discountModal.style.display = 'none';
        }
    }

    showCmdOutput() {
        if (this.cmdOutputWindow) {
            this.cmdOutputWindow.classList.remove('hidden');
            this.cmdOutputWindow.style.display = 'flex';
        }
    }

    hideCmdOutput() {
        if (this.cmdOutputWindow) {
            this.cmdOutputWindow.classList.add('hidden');
            this.cmdOutputWindow.style.display = 'none';
        }
    }

    updateCmdOutput(text) {
        if (this.cmdOutputContent) {
            this.cmdOutputContent.textContent += text + '\n';
            this.cmdOutputContent.scrollTop = this.cmdOutputContent.scrollHeight;
        }
    }

    async processDiscount() {
        const discountPercent = parseFloat(this.discountPercentInput.value);
        if (isNaN(discountPercent) || discountPercent <= 0 || discountPercent >= 100) {
            alert('Bitte geben Sie einen gültigen Prozentsatz zwischen 0 und 100 ein.');
            return;
        }

        try {
            // Verarbeite Hauptprodukte und hole deren Kindartikel
            const products = [];
            const productElements = Array.from(document.querySelectorAll('#productsGrid > div:not(template)'));
            
            if (!productElements || productElements.length === 0) {
                alert('Keine Produkte gefunden.');
                return;
            }

            for (const elem of productElements) {
                const mainProduct = {
                    articleNumber: elem.querySelector('.product-number').textContent.replace('Art.-Nr.: ', ''),
                    uvp: parseFloat(elem.querySelector('.price-uvp').textContent.replace(' €', '').replace(',', '.')),
                    childProducts: []
                };

                // Expandiere das Produkt, falls es noch nicht expandiert ist
                const toggleButton = elem.querySelector('.toggle-children');
                const childContainer = elem.querySelector('.child-products');
                if (toggleButton && childContainer && childContainer.classList.contains('hidden')) {
                    toggleButton.click();
                    // Warte kurz, bis die Kindartikel geladen sind
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Hole die Kindartikel aus dem DOM
                const childElements = elem.querySelectorAll('.child-products > div');
                for (const childElem of childElements) {
                    const articleNumberText = childElem.querySelector('.text-sm.text-gray-500')?.textContent || '';
                    const match = articleNumberText.match(/Art\.-Nr\.: (.+)/);
                    if (!match) continue;
                    
                    const childArticleNumber = match[1];
                    // Der UVP ist derselbe wie beim Hauptprodukt
                    const childPrice = mainProduct.uvp;
                    
                    mainProduct.childProducts.push({
                        articleNumber: childArticleNumber,
                        uvp: childPrice
                    });
                }

                products.push(mainProduct);
            }

            const csvContent = this.generateCsvContent(products, discountPercent);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `rabatt_${timestamp}.csv`;
            const filePath = path.join(os.tmpdir(), fileName);
            
            fs.writeFileSync(filePath, csvContent, 'utf-8');
            this.hideDiscountModal();
            this.showCmdOutput();
            this.updateCmdOutput(`CSV-Datei erstellt: ${filePath}`);
            this.updateCmdOutput(`Rabatt von ${discountPercent}% wird auf ${products.length} Produkte angewendet`);
            
            // Zeige Erfolgsmeldung
            this.updateCmdOutput('\nProdukte erfolgreich verarbeitet:');
            products.forEach(product => {
                const originalPrice = product.uvp;
                const discountedPrice = originalPrice * (1 - discountPercent / 100);
                this.updateCmdOutput(`${product.articleNumber}: ${originalPrice.toFixed(2)}€ -> ${discountedPrice.toFixed(2)}€`);
                
                if (product.childProducts.length > 0) {
                    product.childProducts.forEach(child => {
                        const childOriginalPrice = child.uvp;
                        const childDiscountedPrice = childOriginalPrice * (1 - discountPercent / 100);
                        this.updateCmdOutput(`  └─ ${child.articleNumber}: ${childOriginalPrice.toFixed(2)}€ -> ${childDiscountedPrice.toFixed(2)}€`);
                    });
                }
            });

            // Starte JTL-Ameise Import
            this.updateCmdOutput('\nStarte JTL-Ameise Import...');
            const logFile = path.join(os.tmpdir(), `ameise_log_${timestamp}.txt`);
            const ameisePath = '"C:\\Program Files (x86)\\JTL-Software\\JTL-wawi-ameise.exe"';
            const cmd = `${ameisePath} -s "192.168.1.24,1433\\PKLDATA" -d eazybusiness -u sa -p E{7n-NeH -t IMP7 -i "${filePath}" --log="${logFile}"`;
            
            try {
                const { exec } = require('child_process');
                exec(cmd, (error, stdout, stderr) => {
                    if (error) {
                        this.updateCmdOutput(`\nFehler beim Import: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        this.updateCmdOutput(`\nWarnungen beim Import: ${stderr}`);
                    }
                    this.updateCmdOutput('\nImport erfolgreich abgeschlossen!');
                    this.updateCmdOutput(`Log-Datei: ${logFile}`);
                });
            } catch (error) {
                this.updateCmdOutput(`\nFehler beim Starten der JTL-Ameise: ${error.message}`);
            }

        } catch (error) {
            console.error('Fehler bei der Verarbeitung:', error);
            alert('Fehler bei der Verarbeitung der Produkte.');
        }
    }

    generateCsvContent(products, discountPercent) {
        const lines = ['Artikelnummer;Brutto-VK'];
        
        products.forEach(product => {
            if (!isNaN(product.uvp)) {
                const discountedPrice = product.uvp * (1 - discountPercent / 100);
                lines.push(`${product.articleNumber};${discountedPrice.toFixed(2).replace('.', ',')}`);
            }

            if (product.childProducts && product.childProducts.length > 0) {
                product.childProducts.forEach(child => {
                    if (!isNaN(child.uvp)) {
                        const childDiscountedPrice = child.uvp * (1 - discountPercent / 100);
                        lines.push(`${child.articleNumber};${childDiscountedPrice.toFixed(2).replace('.', ',')}`);
                    }
                });
            }
        });

        return lines.join('\n');
    }
}

// Erstelle eine einzelne Instanz des DiscountManager
const discountManager = new DiscountManager();
