# QuickGraph Public

QuickGraph Public ist die browserbasierte, datensparsame Ausgabe des QuickGraph-Katalogs. Das Repository enthält den bereinigten Vite-Quellcode und exakt acht fest freigegebene neutrale Starter-Skills. Lokale Skills, Apps, Profile, Pfade, Nutzungsdaten und private Assets sind nicht enthalten.

Die kanonische Produktquelle bleibt das private QuickGraph-Repository. Dieser öffentliche Snapshot wird daraus über einen deny-by-default Build erzeugt und vor jedem Review-Branch mit einem festen Datenvertrag, einem Starter-Hash und Inhalts-Scans geprüft.

## Funktionen

- acht neutrale Starter-Skills
- bewusster Browserimport eigener Markdown-, App- und Katalogdateien
- lokale Speicherung in IndexedDB, ohne Upload-Endpunkt
- QuickGraph-, Eigene-Daten- und Virgin-Modus
- Suche, Filter, Detailansicht, Export und lokale Kontextwerkzeuge
- öffentliche OpenRouter-Modellliste

## Lokal starten

Voraussetzungen: Node.js 20 oder neuer und npm.

```bash
git clone https://github.com/DAHANTECH/quickgraph-public.git
cd quickgraph-public
npm install
npm run dev
```

Danach die von Vite angezeigte lokale URL öffnen.

## Prüfen und bauen

```bash
npm test
npm run scan
npm run build
```

`npm run build` führt Typecheck, Public-Vertragstest, Source-Scan, Vite-Build und einen zweiten Scan des fertigen Ordners `dist/` aus. Der statische Inhalt aus `dist/` kann anschließend auf einem normalen Webserver oder über Vercel bereitgestellt werden.

Für Vercel genügt das mitgelieferte `vercel.json`. Es werden keine API-Schlüssel oder Umgebungsvariablen benötigt; der Browseradapter ist im öffentlichen Snapshot fest eingestellt.

## Eigene Inhalte

Eigene Dateien werden erst nach einer bewussten Auswahl im Data Center gelesen. Sie bleiben im lokalen Browser-Speicher der jeweiligen Domain und werden nicht Bestandteil dieses Repositories oder eines öffentlichen Builds.

## Datenschutz und Sicherheit

Details stehen in [PRIVACY.md](PRIVACY.md) und [SECURITY.md](SECURITY.md). Funde, die auf private Daten oder Secrets hindeuten, blockieren den Snapshot-Build.

## Lizenz

Der App-Code steht unter der [MIT-Lizenz](LICENSE). Importierte Inhalte und externe Katalogdaten können eigenen Lizenzbedingungen unterliegen.
