# Deployment – WM-Buchhaltung

Dieser Leitfaden beschreibt, wie die WM-Buchhaltung auf einem produktiven
Linux-Server betrieben wird. Referenz-Setup: Ubuntu 22.04/24.04 LTS,
Docker + Docker Compose, Caddy als TLS-Reverse-Proxy.

---

## 1. Voraussetzungen

| Komponente | Mindestens |
| --- | --- |
| Betriebssystem | Ubuntu 22.04 LTS oder vergleichbar |
| Docker Engine | 24.0+ |
| Docker Compose | v2 (als `docker compose` Plugin) |
| RAM | 2 GB (App + MySQL), 4 GB empfohlen |
| Disk | 20 GB + Platz für Backups |
| Public IP | 1 × IPv4 mit DNS-Eintrag (z.B. `buchhaltung.example.ch`) |
| Erforderliche Ports | 80, 443 (für Caddy), ansonsten alles lokal |

Ausserhalb des Servers:

- **MySQL-kompatibler Storage** (oder Container) – das Compose-File liefert
  MySQL 8 mit.
- **S3-kompatibler Object-Store** für Dokumenten-Uploads (AWS S3, Cloudflare
  R2, MinIO, Scaleway Object Storage…). Empfohlen in der Schweiz:
  Infomaniak Swiss Backup oder Cloudflare R2 mit EU-Data-Residency.
- **OAuth-Provider** (aktuell Manus SDK). Credentials müssen als Env-Vars
  gesetzt sein.
- **LLM-Endpoint** (Forge-API-kompatibel) für Belegerkennung und
  Kategorisierung.

---

## 2. Erste Installation

```bash
# 1. Server vorbereiten
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER && newgrp docker

# 2. Repo clonen
git clone https://github.com/MarcWeibel1971/WM-Buchhaltung.git /opt/wm-buchhaltung
cd /opt/wm-buchhaltung

# 3. .env aus Template erzeugen und Werte setzen
cp .env.example .env
# WICHTIG: JWT_SECRET, MYSQL_*, OAUTH_*, AWS_* mit openssl/Vault füllen.
# openssl rand -hex 64 | tee -a /dev/tty für JWT_SECRET

# 4. Backup-Verzeichnis
mkdir -p backups

# 5. Stack starten (erstmalig läuft der Migrate-Container automatisch mit)
docker compose up -d
docker compose logs -f app
```

Nach erfolgreichem Start erreichst du die App unter
`http://127.0.0.1:3000/` auf dem Server. Für externen Zugriff → TLS
Reverse-Proxy konfigurieren (Abschnitt 3).

### Health-Check verifizieren

```bash
curl http://127.0.0.1:3000/api/health
# {"status":"ok","uptime":12.34,"timestamp":"2026-04-15T…"}
```

---

## 3. Reverse-Proxy mit TLS (Caddy)

`/etc/caddy/Caddyfile`:

```caddy
buchhaltung.example.ch {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000

    # Die App lebt hinter einem Proxy – trust proxy ist bereits gesetzt.
    # Wir reichen X-Forwarded-For / -Proto automatisch weiter.

    # HSTS nur einschalten, wenn du sicher bist dass du bei HTTPS bleibst.
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Maximale Request-Größe etwas großzügiger für File-Uploads (multer limitiert
    # separat auf 20 MB in server/uploadRoute.ts).
    request_body {
        max_size 25MB
    }
}
```

```bash
sudo apt install -y caddy
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy holt das Let's-Encrypt-Zertifikat automatisch beim ersten Request an
die Domain.

Alternative: Nginx oder Traefik – gleiche Logik, andere Syntax. Hauptsache
der Proxy setzt `X-Forwarded-For` und `X-Forwarded-Proto`, sonst erkennt die
Session-Cookie-Middleware HTTPS nicht (`secure` wäre dann false).

---

## 4. Updates ausrollen

```bash
cd /opt/wm-buchhaltung

# Code aktualisieren
git fetch origin
git pull origin main

# Image neu bauen (ruft den builder-Stage neu auf)
docker compose build

# Container neu starten – Migrate läuft automatisch als Init-Container.
docker compose up -d

# Logs checken
docker compose logs -f app
```

### Rollback

```bash
# Vorherige Version per Tag oder Commit zurückholen
git checkout <commit-sha>

# Falls Migration eingeflossen war: vorher DB-Backup zurückspielen!
# (siehe BACKUP.md)

docker compose build
docker compose up -d
```

### Datenbank-Migration ohne App-Restart

```bash
docker compose run --rm migrate
```

---

## 5. Betrieb & Monitoring

### Logs

Die App loggt strukturiert (JSON-Lines, pino) auf stdout. Docker erfasst das
automatisch:

```bash
docker compose logs app                 # alle
docker compose logs -f --tail=100 app   # live, letzte 100 Zeilen
docker compose logs app | jq .          # hübsch parsen
```

Empfohlene nächste Schritte (für mehrere Kunden / Orgs):

- **Log-Aggregation:** Loki + Grafana, oder Datadog/Sentry, oder einfach
  `journald` auf dem Host.
- **Alerting:** Uptime-Robot oder Better Stack pingen `/api/health` alle
  60 Sekunden.

### Metriken

Aktuell exponiert die App nur `/api/health`. Für Prometheus-Metriken
(Request-Rate, Latenz, Fehler) steht die `prom-client`-Integration als
nächster Schritt auf der Roadmap.

### Sentry (optional)

Wenn `SENTRY_DSN` in der `.env` gesetzt ist, werden Errors zusätzlich an
Sentry geschickt. Die Integration ist in der aktuellen Phase als Hook
vorbereitet – die Sentry-SDK-Installation passiert in einer separaten
Ausbaustufe.

---

## 6. Sicherheit – Checkliste

- [x] Alle `publicProcedure` außer `auth.me`/`auth.logout` sind
      `protectedProcedure`/`orgProcedure` (→ Phase 0/1).
- [x] Helmet, CORS, Rate-Limiter aktiv.
- [x] Cookies sind `httpOnly` + `secure` (hinter HTTPS-Proxy) + `SameSite`.
- [x] `JWT_SECRET` ≥ 64 zufällige Hex-Zeichen. **Niemals** den
      Default-Wert aus `.env.example` benutzen.
- [x] MySQL-Port nur auf `127.0.0.1` gebunden (siehe `docker-compose.yml`).
- [ ] Firewall (`ufw`) außer 22/80/443 alles dichtmachen.
- [ ] SSH-Key-Login, kein Passwort-Login, Fail2ban.
- [ ] Automatische Security-Updates: `sudo apt install unattended-upgrades`.
- [ ] Regelmäßige `pnpm audit --audit-level=high` (läuft im CI-Workflow).

### Secrets-Rotation

Wenn ein Secret (JWT, OAuth-Client-Secret, AWS-Key) verbrannt wurde:

1. Neuen Wert in `.env` eintragen.
2. `docker compose up -d` → die App startet mit neuen Env-Vars neu.
3. Für `JWT_SECRET`: alle bestehenden User-Sessions werden invalid – Nutzer
   müssen sich neu einloggen. Das ist beabsichtigt.
4. Altes Secret beim Provider widerrufen.

---

## 7. Troubleshooting

### "ECONNREFUSED" beim App-Start

Die App startet bevor MySQL healthy ist. Das Compose-File hat eine
`depends_on` + `healthcheck`-Kette – wenn es trotzdem klemmt, die MySQL-Logs
checken:

```bash
docker compose logs mysql | tail -50
```

### Migration schlägt fehl

```bash
# Logs des migrate-Containers anschauen
docker compose logs migrate

# Manuell neu ausführen
docker compose run --rm migrate
```

Wenn die Migration eine NOT-NULL-Konstraint-Verletzung wirft: vermutlich
wurden die Backfills aus 0019/0021 nicht gelaufen. **Vor jeder Migration
Backup!** (siehe `BACKUP.md`).

### "Too many requests" bei der Login

Der Rate-Limiter erlaubt 30 OAuth-Callbacks pro 15 Minuten pro IP.
Falls ein Testlauf das sprengt:

```bash
docker compose restart app
```

### Disk voll durch Uploads

Dokumenten-Uploads landen in S3, nicht lokal. Wenn der Host dennoch voll
läuft, liegt es vermutlich an:

1. `docker logs` (Kontainer-stdout). → log-rotation konfigurieren:
   ```json
   // /etc/docker/daemon.json
   { "log-driver": "json-file",
     "log-opts": { "max-size": "50m", "max-file": "5" } }
   ```
2. Alte Images/Layer. → `docker system prune -af` (Vorsicht!).

---

## 8. Nächste Ausbaustufen

Siehe `BACKUP.md` für die Backup-Strategie und den Audit-Bericht in den
Commits für die Roadmap:

1. **Phase 3**: Monitoring (Prometheus + Grafana), Sentry-SDK-Integration,
   Docker-Image-Registry (GHCR).
2. **Phase 4**: Horizontal scaling (mehrere App-Container hinter LB),
   Redis für Session/Rate-Limit-State.
3. **Phase 5**: Automatische Backup-Verification + Restore-Drills
   (quartalsweise, wird dokumentiert in `BACKUP.md`).
