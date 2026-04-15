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
- **Object Storage:** S3-kompatibel (AWS S3, MinIO, Cloudflare R2)
- **Auth:** OAuth via Manus SDK, Session-Cookies
- **PDF / Swiss-Specifics:** swissqrbill, pdf-lib, jsPDF

## Voraussetzungen

- Node.js ≥ 20
- pnpm ≥ 10
- MySQL ≥ 8 (lokal oder remote)
- S3-Bucket (oder S3-kompatibler Storage) für Dokumenten-Uploads
- Zugriff auf die OAuth-Gegenstelle (Manus SDK)

## Quickstart (Entwicklung)

```bash
# 1. Abhängigkeiten installieren
pnpm install

# 2. Environment konfigurieren
cp .env.example .env
# ... .env mit echten Werten füllen ...

# 3. Datenbank-Schema ausrollen
pnpm db:push

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
| `pnpm db:push` | Generiert und migriert das Drizzle-Schema |
| `pnpm format` | Prettier über das gesamte Repository |

## Environment-Variablen

Alle erforderlichen Variablen sind in `.env.example` dokumentiert. Die
wichtigsten:

- `DATABASE_URL` – MySQL-Verbindungsstring
- `JWT_SECRET` – Signing-Secret für Session-Cookies (mind. 64 zufällige Hex)
- `VITE_APP_ID`, `OAUTH_SERVER_URL` – OAuth-Konfiguration
- `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` – LLM-Endpoint
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`

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
- Session-Cookies sind `httpOnly` und `secure` (hinter HTTPS-Proxy)
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

Details zum produktiven Deployment (Docker, CI/CD, Backups) folgen in einer
separaten `DEPLOYMENT.md`.

## Lizenz

MIT
