# QuickGraph Public

QuickGraph ist ein browserbasierter Katalog für Agent-Skills, Prompt-Vorlagen, Markdown-Kontext, Apps und OpenRouter-Modelle. Die öffentliche Version benötigt kein Konto, kein lokales Backend und keine API-Schlüssel.

> **Release-Hinweis:** Dieses Repository ist der bereinigte öffentliche Deployment-Spiegel. Die kanonische Produktquelle ist das private QuickGraph-React-Repository auf Branch `main`. Die aktive Website liegt vollständig in `public/`; ältere Dateien im Repository-Stamm werden nicht ausgeliefert und sind keine zweite Produktversion.

**Live ausprobieren:** [quickgraph-public.vercel.app](https://quickgraph-public.vercel.app)

## Was die App kann

- neutrales Starter-Paket ohne persönliche oder lokal installierte Skill-Inhalte
- Import eigener `SKILL.md`, App-Ordner und Katalog-JSON
- Import von `CLAUDE.md`, `AGENTS.md`, `MEMORY.md`, `default.rules` und `config.toml`
- Suche, Kategorien, Kachel-/Listenansicht, Volltext-Flyout, Kopieren und Export
- Ampelsystem, Token-/Zeilenmetriken, Kontextkosten und Browser-Backup
- getrennte Monitore für CLAUDE.md, Claude Memory und Codex-Kontextdateien
- aktuelle OpenRouter-Modelldaten über die öffentliche API
- Starter-, Eigene-Daten-, Demo- und Virgin-Modus
- virtuelle Onboarding-Tour über das Hilfe-Icon

## Welche Version ist die richtige?

| | QuickGraph Public / Self-hosted | Private Original-App |
|---|---|---|
| Installation | statische Website | lokaler QuickGraph-Server plus persönliche Konfiguration |
| Eigene Dateien | Auswahl durch den Nutzer im Browser | automatische Indizierung lokaler Verzeichnisse möglich |
| Speicherung | im Browser des Nutzers | lokale Dateien und lokaler Server |
| Claude-/Codex-Nutzung | importierte Dateien und neutrale Beispieldaten | Live-Status und Nutzungsdaten der lokalen Installation |
| Apps starten | externe Links anzeigen | konfigurierte lokale Apps und Prozesse starten |
| Konto/API-Key | nicht erforderlich | abhängig von den lokal verbundenen Werkzeugen |
| Geeignet für | Ausprobieren, eigener Katalog, Intranet, Self-Hosting | persönliche Operator-Installation auf dem eigenen Rechner |

Dieses Repository enthält die öffentliche, datenschutzorientierte Version. Es enthält weder die private Original-App noch persönliche Dateien, Zugangsdaten oder lokale Prozesskonfigurationen. Browser können aus Sicherheitsgründen nicht selbstständig beliebige Verzeichnisse auf einem Rechner durchsuchen. Eigene Inhalte werden deshalb bewusst über **Daten verwalten** ausgewählt.

## Schnellstart für Einsteiger

### Voraussetzungen

- [Git](https://git-scm.com/downloads)
- [Node.js 20 oder neuer](https://nodejs.org/)

Es müssen keine npm-Pakete installiert werden. Dieses Deployment-Repository liefert den bereits geprüften React-Release aus.

### 1. Repository herunterladen

```bash
git clone https://github.com/DAHANTECH/quickgraph-public.git
cd quickgraph-public
```

Ohne Git: Auf GitHub **Code -> Download ZIP** wählen, das ZIP entpacken und im Terminal in den entpackten Ordner wechseln.

### 2. Lokal starten

```bash
npm run dev
```

Danach im Browser öffnen: [http://localhost:4173](http://localhost:4173)

Die Onboarding-Tour lässt sich über das Hilfe-Icon starten. Über das Datenbank-Icon oben rechts lassen sich Demo-, Virgin- und Eigene-Daten-Modus wählen sowie eigene Dateien importieren.

### 3. Lokalen Server beenden

Im Terminal `Ctrl+C` drücken.

Falls Port 4173 bereits belegt ist:

```bash
PORT=4174 npm run dev
```

## Produktionsbuild erstellen

```bash
npm run build
```

Der Build-Befehl validiert den versionierten, vollständig statischen React-Release im Ordner `public/`. Lokal lässt er sich so prüfen:

```bash
npm run preview
```

`public/` kann anschließend auf praktisch jedem statischen Webserver veröffentlicht werden.

## Auf Vercel veröffentlichen

### Variante A: Über die Vercel-Oberfläche

1. Das GitHub-Repository forken oder in das eigene GitHub-Konto kopieren.
2. Bei [vercel.com](https://vercel.com/) anmelden.
3. **Add New -> Project** wählen.
4. Das QuickGraph-Repository importieren.
5. Als Framework **Other** verwenden.
6. Build Command: `npm run build`
7. Output Directory: `public`
8. **Deploy** klicken.

Die mitgelieferte `vercel.json` setzt Output-Verzeichnis und Sicherheitsheader bereits automatisch.

### Variante B: Über die Vercel CLI

```bash
npx vercel
```

Für die produktive Veröffentlichung:

```bash
npx vercel --prod
```

Beim ersten Aufruf fragt Vercel nach Team, Projektname und Verknüpfung. Es werden keine Umgebungsvariablen oder API-Schlüssel benötigt.

## Mit Docker starten

Voraussetzung: [Docker Desktop](https://www.docker.com/products/docker-desktop/) oder Docker Engine mit Compose.

```bash
docker compose up --build -d
```

Danach öffnen: [http://localhost:8080](http://localhost:8080)

Container stoppen:

```bash
docker compose down
```

Nach einem Update neu bauen:

```bash
git pull
docker compose up --build -d
```

Der Docker-Build erzeugt zuerst den statischen QuickGraph-Build und liefert ihn anschließend über nginx aus. Die nginx-Konfiguration liegt in `deploy/nginx.conf`.

## Auf einem vorhandenen nginx-Server installieren

Zuerst lokal bauen und die Dateien übertragen:

```bash
npm run build
rsync -av --delete public/ user@example.com:/tmp/quickgraph/
scp deploy/nginx.conf user@example.com:/tmp/quickgraph-nginx.conf
```

Danach auf dem Server:

```bash
sudo mkdir -p /var/www/quickgraph
sudo cp -a /tmp/quickgraph/. /var/www/quickgraph/
sudo cp /tmp/quickgraph-nginx.conf /etc/nginx/conf.d/quickgraph.conf
sudo nginx -t
sudo systemctl reload nginx
```

In `deploy/nginx.conf` anschließend `server_name _;` durch die eigene Domain ersetzen. Für eine öffentliche Domain sollte zusätzlich HTTPS eingerichtet werden, beispielsweise mit Certbot.

## Eigene Skills und Dateien verwenden

1. QuickGraph öffnen.
2. Oben rechts **Daten verwalten** wählen.
3. Einen Datenmodus auswählen:
   - **QuickGraph-Daten:** neutrale Beispiele plus eigene Importe
   - **Eigene Daten:** ausschließlich selbst importierte Inhalte
   - **Demo:** kleine neutrale Beispieldaten
   - **Virgin:** leerer Katalog ohne Löschung vorhandener Importe
4. Skill-Dateien, Skill-Ordner, App-Ordner, Kontextdateien oder Katalog-JSON auswählen.

Importierte Daten bleiben im lokalen Browser-Speicher der jeweiligen Domain. Ein Import auf `localhost` erscheint daher nicht automatisch auf einer anderen Domain, in einem anderen Browser oder auf einem anderen Gerät.

## Tests und Sicherheitsprüfung

```bash
npm test
npm run scan
```

Der Datenschutzscan sucht nach bekannten privaten Pfaden und Secret-Mustern. Details zum Datenschutz stehen in [PRIVACY.md](PRIVACY.md), Sicherheitshinweise in [SECURITY.md](SECURITY.md).

## Häufige Probleme

**Die Seite bleibt leer oder JavaScript wird blockiert:** Die HTML-Datei nicht direkt per `file://` öffnen. Immer `npm run dev`, `npm run preview`, Docker oder einen Webserver verwenden.

**Eigene Daten fehlen nach einem Domainwechsel:** Browser-Speicher ist an Domain und Browserprofil gebunden. Die Dateien auf der neuen Domain erneut importieren.

**OpenRouter aktualisiert nicht:** Der Server muss ausgehende HTTPS-Verbindungen zu `https://openrouter.ai` erlauben. Die mitgelieferten Vercel- und nginx-Regeln erlauben ausschließlich diese externe Datenquelle.

**Port 4173 oder 8080 ist belegt:** Für Node `PORT=4174 npm run dev` verwenden. Bei Docker den linken Port in `compose.yaml` ändern, beispielsweise `8081:80`.

## Lizenz

Der App-Code steht unter der [MIT-Lizenz](LICENSE). Katalogmetadaten und eingebettete Skilltexte können eigene Ursprungslizenzen haben. Diese müssen vor Weiterverteilung oder kommerzieller Nutzung separat geprüft werden. Importierte Nutzerdateien bleiben Eigentum des jeweiligen Nutzers.
