# Q-Ware Tracker

Eine moderne Anwendung zur Verwaltung und Überwachung von JTL-Produkten.

## Features

- Anzeige von Produkten und deren Varianten
- Verkaufsdaten der letzten 3 Monate
- Bestandsüberwachung
- Gewinn- und Margenberechnung
- Filterfunktionen nach Jahr, Quartal, Hersteller und Warengruppe
- Moderne und benutzerfreundliche Oberfläche

## Installation

1. Repository klonen:
```bash
git clone https://github.com/yourusername/jtl-q-inventory.git
cd jtl-q-inventory
```

2. Dependencies installieren:
```bash
npm install
```

3. Anwendung starten:
```bash
npm start
```

## Build

### Windows Build erstellen:
```bash
npm run build:win
```

### Mac Build erstellen:
```bash
npm run build:mac
```

### Beide Plattformen bauen:
```bash
npm run build
```

Die fertigen Builds befinden sich im `dist` Ordner.

## Konfiguration

Die Datenbank-Konfiguration muss in der `config.js` vorgenommen werden:

```javascript
module.exports = {
    sql: {
        server: 'YOUR_SERVER',
        database: 'YOUR_DATABASE',
        user: 'YOUR_USERNAME',
        password: 'YOUR_PASSWORD',
        options: {
            encrypt: true,
            trustServerCertificate: true
        }
    }
};
```

## License

ISC
