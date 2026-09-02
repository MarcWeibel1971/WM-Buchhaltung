# Self-Hosting: WM-Buchhaltung auf eigenem Server

Diese Anleitung beschreibt die reproduzierbare Installation ausserhalb der
Manus-Plattform (eigener Server, VM oder Container). Die App ist bewusst
plattform-unabhängig gebaut: **Pflicht sind nur Node.js, MySQL 8 und zwei
Umgebungsvariablen** – alle Plattform-Features (E-Mail, KI, Storage) sind
konfigurierbare Provider oder sauber deaktiviert.

## Voraussetzungen

| Komponente | Version | Bemerkung |
|---|---|---|
| Node.js | 20 LTS | `node --version` |
| pnpm | 10.x | `npm install -g pnpm@10.4.1` |
| MySQL | 8.0+ (oder MariaDB 10.6+) | eigene Instanz oder Container |
| Git | beliebig | zum Auschecken |

## Installation (Schritt für Schritt)

```bash
# 1. Code auschecken
git clone https://github.com/<owner>/WM-Buchhaltung.git
cd WM-Buchhaltung

# 2. Abhängigkeiten installieren
pnpm install --frozen-lockfile

# 3. Umgebung konfigurieren
cp .env.example .env
$EDITOR .env
```

Mindestens diese zwei Werte setzen:

```bash
DATABASE_URL=mysql://wmuser:<passwort>@localhost:3306/wm_buchhaltung
JWT_SECRET=<openssl rand -hex 64>
```

```bash
# 4. Datenbank anlegen (einmalig)
mysql -u root -p -e "CREATE DATABASE wm_buchhaltung CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'wmuser'@'%' IDENTIFIED BY '<passwort>';
  GRANT ALL PRIVILEGES ON wm_buchhaltung.* TO 'wmuser'@'%'; FLUSH PRIVILEGES;"

# 5. Migrationen ausführen (legt alle Tabellen an)
pnpm drizzle-kit migrate

# 6. Produktions-Build + Start
pnpm build
pnpm start          # oder NODE_ENV=production node dist/index.js
```

Die App läuft danach auf `http://<server>:3000`. Beim Start protokolliert sie
eine **Feature-Zusammenfassung** (E-Mail, KI, Storage) – fehlende optionale
Keys erscheinen dort als hilfreiche Warnung, nicht als Fehler.

## Was funktioniert ohne welchen Key?

| Feature | Braucht | Ohne Key |
|---|---|---|
| Buchhaltung, Rechnungen, QR, MWST, Mahnwesen, Berichte | nichts | funktioniert vollständig |
| Login (E-Mail/Passwort) | `JWT_SECRET` | – (Pflicht) |
| Datei-Uploads (Belege, PDFs) | nichts | lokaler Speicher unter `./data/uploads` (mit `LOCAL_STORAGE_DIR` auf persistentes Volume legen) |
| E-Mail-Versand (Registrierung, Rechnungen, Mahnungen) | `RESEND_API_KEY` **oder** `SMTP_HOST` | kein Versand; App zeigt das ehrlich an (AP4.6) |
| KI-Beleganalyse / KI-Kategorisierung | `BUILT_IN_FORGE_API_KEY` **oder** `OPENROUTER_API_KEY` | KI-Buttons werden im UI ausgeblendet (AP3.3) |
| EBICS / POS-Schnittstellen | `SECRETS_MASTER_KEY` | Secrets können nicht gespeichert werden |
| Manus-OAuth, Stripe-Abo, ElevenLabs, Sentry | jeweilige Keys | deaktiviert |

## E-Mail einrichten (empfohlen)

Ohne E-Mail-Versand können sich neue Benutzer **nicht selbst verifizieren**
(die Bestätigungs-Mail kommt nie an). Zwei Wege:

**Variante A – Resend:** Konto auf resend.com, Domain verifizieren, dann
`RESEND_API_KEY` + `RESEND_FROM_EMAIL` setzen.

**Variante B – eigener SMTP-Server** (z.B. Infomaniak, eigener Mailserver):

```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.example.ch
SMTP_PORT=587
SMTP_USER=buchhaltung@example.ch
SMTP_PASS=<passwort>
SMTP_FROM=buchhaltung@example.ch
```

**Notfall ohne Mailserver:** Benutzer manuell verifizieren –

```sql
UPDATE users SET emailVerified = 1 WHERE email = 'benutzer@example.ch';
```

## Reverse Proxy (empfohlen für TLS)

Beispiel Caddy (`Caddyfile`):

```
buchhaltung.example.ch {
    reverse_proxy 127.0.0.1:3000
}
```

Beispiel nginx:

```nginx
server {
    listen 443 ssl;
    server_name buchhaltung.example.ch;
    # ssl_certificate / ...;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 25m;   # Beleg-Uploads
    }
}
```

## Dienst einrichten (systemd)

```ini
# /etc/systemd/system/wm-buchhaltung.service
[Unit]
Description=WM-Buchhaltung
After=network.target mysql.service

[Service]
Type=simple
User=wm
WorkingDirectory=/opt/wm-buchhaltung
EnvironmentFile=/opt/wm-buchhaltung/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Updates

```bash
git pull
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate   # wendet nur neue Migrationen an
pnpm build
systemctl restart wm-buchhaltung
```

Hinweis: Migrationen sind fix-forward – vor Updates ein Backup machen.

## Backup

Zwei Dinge sichern:

```bash
# 1. Datenbank
mysqldump -u wmuser -p wm_buchhaltung | gzip > backup-$(date +%F).sql.gz

# 2. Lokale Uploads (falls kein Remote-Storage)
tar czf uploads-$(date +%F).tgz data/uploads/
```

## Docker

Alternativ steht ein `Dockerfile` und eine `docker-compose.yml` (App + MySQL)
im Repository; siehe `DEPLOYMENT.md`. Die `.env`-Werte oben gelten dort
gleichermassen.
