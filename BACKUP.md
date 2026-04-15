# Backup & Disaster Recovery – WM-Buchhaltung

Eine Buchhaltung ist ohne zuverlässige Backups wertlos. Dieses Dokument
definiert die **Backup-Policy** für produktive Installationen der
WM-Buchhaltung. Die Anforderungen leiten sich direkt aus der Schweizer
Gesetzgebung ab (OR Art. 958f, GeBüV Art. 9–10): Buchhaltungsunterlagen
müssen **10 Jahre** ordnungsgemäß, unveränderbar und jederzeit lesbar
aufbewahrt werden.

---

## 1. Was wird gebackupt?

| Quelle | Inhalt | Art |
| --- | --- | --- |
| **MySQL** | Journal, Kontenplan, Bank-Transaktionen, Lohn, MWST, Orgs, User, Audit-Log | relationale DB (mysqldump) |
| **S3-Bucket** | Dokumente (Rechnungen, Belege, Kontoauszüge, Lohnausweise), Logos, Templates | Object-Storage |
| **`.env`** | Secrets (JWT_SECRET, OAuth, AWS, MySQL-Passwörter) | separat + verschlüsselt |
| **Drizzle-Migrationen** | `drizzle/*.sql`, `drizzle/meta/` | im Git-Repo |

> **Kritisch**: MySQL **und** S3 müssen konsistent gebackupt werden.
> Ein MySQL-Backup ohne die referenzierten Dokumenten-Dateien ist für eine
> Steuerprüfung wertlos.

---

## 2. Backup-Rotation (3-2-1-1-0 angelehnt)

- **3 Kopien** der Daten (Original + 2 Backups)
- **2 verschiedene Medien/Standorte**
- **1 off-site** (anderer geografischer Standort)
- **1 offline/immutable** (nicht überschreibbar auch bei Ransomware)
- **0 Fehler bei der Restore-Verifikation**

### Aufbewahrungsplan

| Stufe | Frequenz | Retention | Speicherort |
| --- | --- | --- | --- |
| **Daily** | 1× täglich, 03:00 CET | 14 Tage | Server lokal (`/opt/wm-buchhaltung/backups`) |
| **Weekly** | Sonntag 04:00 CET | 8 Wochen | Off-site Object-Storage (z.B. Infomaniak Swiss Backup) |
| **Monthly** | 1. des Monats | 13 Monate | Off-site Object-Storage |
| **Yearly / GeBüV** | 31. Dezember | **10 Jahre + 1** | Off-site, WORM-Bucket (Object-Lock) |

Die 10-Jahres-Yearlies sind die gesetzliche Pflicht (OR Art. 958f). Sie
müssen in einem **WORM-Modus** (Write-Once-Read-Many, z.B. S3 Object Lock
Compliance-Mode) liegen, damit auch ein Admin sie nicht vorzeitig löschen
kann.

---

## 3. MySQL-Backup

### Tägliches Dump

`/opt/wm-buchhaltung/scripts/backup-mysql.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Läuft auf dem Docker-Host und ruft mysqldump im Compose-Netzwerk auf.
cd /opt/wm-buchhaltung
source .env

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/opt/wm-buchhaltung/backups"
mkdir -p "$BACKUP_DIR/daily"

docker compose exec -T mysql \
  mysqldump \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --set-gtid-purged=OFF \
    --default-character-set=utf8mb4 \
    -u root -p"$MYSQL_ROOT_PASSWORD" \
    "$MYSQL_DATABASE" \
  | gzip -9 > "$BACKUP_DIR/daily/wm-${DATE}.sql.gz"

# Verify: gzip -t
gzip -t "$BACKUP_DIR/daily/wm-${DATE}.sql.gz"

# Retention: 14 Tage
find "$BACKUP_DIR/daily" -name 'wm-*.sql.gz' -mtime +14 -delete

echo "[backup-mysql] OK: $BACKUP_DIR/daily/wm-${DATE}.sql.gz"
```

```bash
chmod +x /opt/wm-buchhaltung/scripts/backup-mysql.sh
```

**Cron-Eintrag** (`sudo crontab -e`):

```cron
# Tägliches MySQL-Backup um 03:00
0 3 * * * /opt/wm-buchhaltung/scripts/backup-mysql.sh >> /var/log/wm-backup.log 2>&1
```

### Was `--single-transaction` bedeutet

`mysqldump --single-transaction` nimmt einen konsistenten Snapshot in einer
Transaktion, ohne Schreiben zu blockieren. Funktioniert mit InnoDB
(MySQL 8 default). Bei MyISAM-Tabellen (wir haben keine) wäre
`--lock-tables` nötig.

### Recovery aus einem Dump

```bash
# 1. App stoppen
docker compose stop app migrate

# 2. Datenbank droppen und neu anlegen
docker compose exec mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e \
  "DROP DATABASE IF EXISTS $MYSQL_DATABASE; CREATE DATABASE $MYSQL_DATABASE CHARACTER SET utf8mb4;"

# 3. Dump einspielen
gunzip -c /opt/wm-buchhaltung/backups/daily/wm-2026-04-15.sql.gz \
  | docker compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"

# 4. App neu starten
docker compose up -d
```

### Punkt-in-Zeit-Recovery

Für Sekunden-genaue Recovery (z.B. "rücke 20 Minuten zurück weil jemand
einen Fehler gebucht hat") braucht es **Binary Logging** + Incremental
Backups:

```ini
# mysql my.cnf (via docker-compose environment: MYSQL_INITDB_SETTINGS)
[mysqld]
log-bin = /var/lib/mysql/binlog
binlog_expire_logs_seconds = 1209600  # 14 Tage
```

Das ist optional und für die meisten KMU-Setups überdimensioniert. Tägliche
Dumps + Dokumenten-Backup reichen für GeBüV-Compliance.

---

## 4. S3-Bucket-Backup

Die Dokumente liegen im konfigurierten S3-Bucket. Zwei Ansätze:

### Ansatz A: **Cross-Region-Replication** (empfohlen)

Bei AWS S3 bzw. S3-kompatiblen Providern (Cloudflare R2, Scaleway, MinIO):

```bash
aws s3api put-bucket-replication \
  --bucket wm-buchhaltung-prod \
  --replication-configuration file://replication.json
```

Das spiegelt neue/geänderte Objekte **automatisch** in ein zweites Bucket
(idealerweise in einer anderen Region oder einem anderen Provider).

### Ansatz B: **Nightly sync**

`/opt/wm-buchhaltung/scripts/backup-s3.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SOURCE="s3://wm-buchhaltung-prod"
TARGET="s3://wm-buchhaltung-backup/$(date +%Y-%m-%d)"

aws s3 sync "$SOURCE" "$TARGET" \
  --storage-class GLACIER_IR \
  --only-show-errors

echo "[backup-s3] OK: $TARGET"
```

```cron
0 4 * * * /opt/wm-buchhaltung/scripts/backup-s3.sh >> /var/log/wm-backup.log 2>&1
```

Für S3-kompatible Provider `rclone sync` verwenden.

### WORM-Bucket für GeBüV-Archiv

Für die **10-Jahres-Aufbewahrung** einen separaten Bucket mit Object-Lock
einrichten:

```bash
aws s3api put-object-lock-configuration \
  --bucket wm-buchhaltung-gebuev \
  --object-lock-configuration 'ObjectLockEnabled=Enabled,Rule={DefaultRetention={Mode=COMPLIANCE,Years=11}}'
```

Im **Compliance-Mode** kann niemand (auch nicht der Root-User) das Objekt
vor Ablauf löschen oder ändern – genau das, was GeBüV verlangt.

Einmal pro Jahr (31.12.) wird ein kompletter Snapshot in diesen Bucket
geladen:

```bash
#!/usr/bin/env bash
# /opt/wm-buchhaltung/scripts/backup-yearly.sh
YEAR=$(date +%Y)

# MySQL-Dump
docker compose exec -T mysql mysqldump ... > /tmp/mysql-${YEAR}.sql
gzip -9 /tmp/mysql-${YEAR}.sql

# Alle Dokumente
tar -czf /tmp/s3-${YEAR}.tar.gz -C /mnt/s3-rclone .

# Upload in WORM-Bucket
aws s3 cp /tmp/mysql-${YEAR}.sql.gz s3://wm-buchhaltung-gebuev/yearly/${YEAR}/mysql.sql.gz
aws s3 cp /tmp/s3-${YEAR}.tar.gz     s3://wm-buchhaltung-gebuev/yearly/${YEAR}/documents.tar.gz

# Lokale Kopien löschen (sind jetzt im immutablen Bucket)
shred -u /tmp/mysql-${YEAR}.sql.gz /tmp/s3-${YEAR}.tar.gz
```

---

## 5. Secrets-Backup

Die `.env` enthält Passwörter und API-Keys – **niemals** in Git oder in den
gleichen Bucket wie die Daten committen. Zwei Optionen:

1. **Passwort-Manager** (1Password, Bitwarden). Der `.env`-Inhalt landet
   dort als verschlüsselte Notiz. Bei Disaster-Recovery wird sie
   heruntergeladen und auf dem neuen Server platziert.

2. **GPG-verschlüsselt + off-site**:
   ```bash
   gpg --encrypt --recipient admin@example.ch .env > .env.gpg
   aws s3 cp .env.gpg s3://wm-buchhaltung-secrets/
   ```

Der Wiederherstellungs-Weg muss dokumentiert und regelmäßig getestet
werden – siehe Abschnitt 6.

---

## 6. Restore-Drill (quartalsweise)

Ein Backup ist erst dann ein Backup, wenn der Restore funktioniert. Jedes
Quartal soll ein **Restore-Drill** auf einer isolierten Test-VM
durchgeführt werden:

### Drill-Checkliste

- [ ] Frisches Ubuntu installieren (oder VM-Snapshot auf leer)
- [ ] Docker + Docker Compose einrichten
- [ ] Repo klonen
- [ ] `.env` aus Secrets-Backup wiederherstellen
- [ ] Neuesten täglichen MySQL-Dump einspielen
- [ ] S3-Bucket-Spiegel als `AWS_S3_BUCKET` konfigurieren
- [ ] `docker compose up -d`
- [ ] Manuell verifizieren:
  - [ ] Login via OAuth funktioniert
  - [ ] `reports.balanceSheet` für 2026 liefert plausible Zahlen
  - [ ] Ein Beleg-PDF aus S3 lässt sich öffnen
  - [ ] `audit_log` enthält die letzten Einträge
- [ ] Drill-Protokoll in `/docs/drills/YYYY-QN.md` festhalten (Dauer, Probleme,
      Action Items)
- [ ] Test-VM wieder zerstören

### Drill-Metriken

| Metrik | Zielwert |
| --- | --- |
| RTO (Recovery Time Objective) | ≤ 4 Stunden |
| RPO (Recovery Point Objective) | ≤ 24 Stunden |
| Drill-Erfolgsquote | 100 % der letzten 4 Drills |

Bei Verfehlung der Zielwerte: Backup-Strategie eskalieren (häufigere Dumps,
CDC, dedizierter DR-Standby).

---

## 7. Verantwortlichkeiten

Die Firma, die die WM-Buchhaltung produktiv nutzt, ist verantwortlich für
ihre eigenen Backups. Bei einer **Multi-Tenant-Installation** (mehrere
Kunden in einer Instanz) trägt der Betreiber die Verantwortung – in diesem
Fall muss der Backup-Plan im Servicevertrag mit klaren SLAs verankert sein.

### Typische Rollenzuteilung

| Rolle | Aufgabe |
| --- | --- |
| **Betriebsverantwortlicher** | Cron-Jobs, Restore-Drills, Disk-Monitoring |
| **Treuhänder / Buchhalter** | Prüft monatlich, ob Belege und Journal konsistent sind (→ Audit-Log) |
| **Owner der Org** | Stellt sicher, dass GeBüV-relevante Yearlies in den WORM-Bucket geladen wurden |

---

## 8. Compliance-Nachweis

Für eine Steuerprüfung müssen folgende Artefakte vorliegen:

1. **Backup-Plan** (dieses Dokument)
2. **Cron-Logs** der letzten 12 Monate (`/var/log/wm-backup.log`)
3. **Drill-Protokolle** der letzten 4 Quartale
4. **Nachweis der WORM-Konfiguration** des Yearly-Buckets
   (`aws s3api get-object-lock-configuration ...`)
5. **Audit-Log-Export** (`dsgRouter.exportPersonalData`) als Nachweis der
   Datenschutz-Compliance

Diese Dokumentation muss sowohl beim Betreiber als auch beim Treuhänder
vorhanden sein und jährlich überprüft werden.
