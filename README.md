# WM-Buchhaltung

Schweizer Buchhaltungs-Webapp für Kleinunternehmen. Doppelte Buchführung,
MWST-Abrechnung (effektiv / saldo / pauschal), Bank-Import (CAMT.053, MT940,
CSV, PDF), KI-gestützte Belegerkennung, QR-Rechnung, ISO 20022 pain.001
Zahlungsdatei-Export, Lohnbuchhaltung mit Lohnausweis Formular 11 und
DSG-konformes Audit-Logging.

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query,
  Wouter (Routing), tRPC client
- **Backend:** Node.js, Express, tRPC, Drizzle ORM
- **Datenbank:** MySQL 8
- **Datei-Storage:** lokales Verzeichnis (`LOCAL_STORAGE_DIR`, Default `./data/uploads`)
  oder Forge-Storage der Manus-Plattform
- **Auth:** E-Mail/Passwort (bcrypt, E-Mail-Verifizierung) und optional OAuth via
  Manus SDK; Session-Cookies (HttpOnly, SameSite=Lax)
- **PDF / Swiss-Specifics:** swissqrbill, pdf-lib, jsPDF

## Voraussetzungen

- Node.js ≥ 20
- pnpm ≥ 10
- MySQL ≥ 8 (lokal oder remote)
- Ein beschreibbares Verzeichnis (oder Volume) für Dokumenten-Uploads
- Optional: E-Mail-Provider (Resend oder SMTP) für Registrierungs-, Rechnungs-
  und Mahn-E-Mails

## Quickstart (Entwicklung)

```bash
# 1. Abhängigkeiten installieren
pnpm install

# 2. Environment konfigurieren
cp .env.example .env
# ... .env mit echten Werten füllen ...

# 3. Datenbank-Migrationen ausrollen
pnpm drizzle-kit migrate

# 4. Dev-Server starten (http://localhost:3000)
pnpm dev
```

## Scripts

| Skript | Zweck |
| --- | --- |
| `pnpm dev` | Startet den Express-Server mit `tsx watch` (inkl. Vite HMR) |
| `pnpm build` | Baut Frontend (Vite) und Backend (esbuild) nach `dist/` |
| `pnpm start` | Startet den produktiven Server aus `dist/` |
| `pnpm check` | TypeScript-Typecheck (`tsc --noEmit`) |
| `pnpm test` | Führt die Vitest-Testsuite aus |
| `pnpm drizzle-kit migrate` | Wendet die Migrationen aus `drizzle/` an (Produktion) |
| `pnpm db:push` | Generiert eine neue Migration aus `drizzle/schema.ts` und wendet sie an (Entwicklung) |
| `pnpm test:core-chain` | E2E-Kernkette gegen einen laufenden Server |
| `pnpm format` | Prettier über das gesamte Repository |

## Environment-Variablen

Alle erforderlichen Variablen sind in `.env.example` dokumentiert. Die
wichtigsten:

- `DATABASE_URL` – MySQL-Verbindungsstring (Pflicht)
- `JWT_SECRET` – Signing-Secret für Session-Cookies (Pflicht, `openssl rand -hex 64`)
- `APP_URL` – öffentliche Basis-URL für Links in E-Mails (für Produktion dringend empfohlen)
- `SECRETS_MASTER_KEY` – Verschlüsselung von EBICS-/POS-Secrets (`openssl rand -hex 32`)
- `EMAIL_PROVIDER`, `RESEND_API_KEY` bzw. `SMTP_*` – E-Mail-Versand
- `LOCAL_STORAGE_DIR` – Ablage für Belege/PDFs (persistentes Volume)
- `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` oder `OPENROUTER_API_KEY` – KI-Features
- `VITE_APP_ID`, `OAUTH_SERVER_URL` – nur für Manus-OAuth

## Projektstruktur

```
client/          React-Frontend (Vite)
  src/pages/     Seiten / Routen
  src/components Shared UI-Komponenten
server/          Express + tRPC Backend
  _core/         Auth, OAuth, LLM, Storage, Context, Trpc Setup
  routers.ts     tRPC Root-Router (wird sukzessive modularisiert)
  db.ts          Drizzle-Queries
  *Router.ts     Feature-Router (dsg, qrBill, yearEnd, settings)
shared/          Zwischen Client und Server geteilter Code
drizzle/         Schema, Migrationen, Snapshots
scripts/         CLI-Helferskripte
```

## Health-Check

Der Server exponiert einen unauthentifizierten Health-Check unter
`GET /api/health`. Nutze ihn für Container-Orchestrierung und Uptime-Monitoring.

```bash
curl http://localhost:3000/api/health
# {"status":"ok","uptime":123.45,"timestamp":"2026-04-15T12:34:56.789Z"}
```

## Sicherheit

- Helmet setzt Security-Header (CSP, X-Frame-Options, etc.)
- `express-rate-limit` schützt `/api/trpc`, `/api/upload` und `/api/oauth`
- JSON-Body-Parser ist auf 2 MB limitiert; File-Uploads werden von `multer`
  mit separatem 20-MB-Limit verarbeitet
- Session-Cookies sind `httpOnly`, `secure` (hinter HTTPS-Proxy) und `SameSite=Lax`
- Login, Registrierung und Passwort-Reset haben einen eigenen Brute-Force-Limiter
  (20 Versuche / 15 Minuten / IP)
- Links in E-Mails (Verifizierung, Reset, Einladung) werden serverseitig aus
  `APP_URL` gebaut, nie aus Client-Angaben
- Dokumente unter `/manus-storage/*` werden nur mit gültiger Session ausgeliefert
- Alle geschäftlichen tRPC-Prozeduren erfordern eine gültige Session
- Dokumenten-Uploads werden MIME-gefiltert (PDF, JPEG, PNG, WEBP)

## Schweizer Compliance

Die App unterstützt die typischen Anforderungen an ein Schweizer KMU-Buchhaltungs-System:

- **OR Art. 957–963b** – Doppelte Buchführung, Belege, Aufbewahrung
- **GeBüV** – Journal-Immutabilität nach Approval, fortlaufende Belegnummern,
  Audit-Log
- **MWSTG** – Sätze 8.1% / 2.6% / 3.8%, effektive / Saldosteuersatz / pauschale
  Methode, Abrechnungszeiträume quartalsweise oder semestriell
- **revDSG** (Datenschutzgesetz) – Audit-Log, Datenexport (Art. 25),
  Anonymisierung (Art. 22)
- **Lohnausweis** – offizielles Formular 11 per AcroForm-Befüllung

## Deployment

Details zum produktiven Deployment (Docker, CI/CD, Backups): `DEPLOYMENT.md`,
Self-Hosting ohne Plattform-Keys: `SELFHOSTING.md`, Backup-Policy: `BACKUP.md`.

## Lizenz

MIT
