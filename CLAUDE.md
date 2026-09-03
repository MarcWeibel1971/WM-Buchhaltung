# WM-Buchhaltung (KLAX) — Claude Code Instructions

> Dieses File wird von Rippletide verwaltet. Manuelle Änderungen werden beim nächsten `npx rippletide-code` überschrieben.
> Regeln bearbeiten: `.rippletide/selected-rules.md`

## Projekt-Übersicht

**App:** WM-Buchhaltung / KLAX — Schweizer Buchhaltungs-Webapp für KMU (doppelte Buchführung, MWST, Bank-Import, QR-Rechnung, Lohn, DSG-Audit-Log)
**Stack:** React 19 · Vite 7 · TypeScript 5.9 · Express 4 · tRPC 11 · Drizzle ORM · MySQL 8 · Zod 4 · Vitest · Docker
**Sprache:** Deutsch (UI + Code-Kommentare, Schweizer Schreibweise ohne «ß»)

## Kritische Regeln (werden bei jedem Commit geprüft)

### Authentifizierung & Mandantentrennung

Org-bezogene tRPC-Prozeduren MÜSSEN `orgProcedure` verwenden und `ctx.organizationId` in jedem WHERE-Filter setzen. Verwaltungsfunktionen laufen über `adminProcedure`. `organizationId`/`userId` niemals aus dem Input lesen. Express-Routen ausserhalb von tRPC rufen `sdk.authenticateRequest(req)` auf oder verifizieren eine Webhook-Signatur. E-Mail-Links werden über `resolvePublicOrigin()` (`server/_core/publicUrl.ts`) gebaut.

### Buchhaltungslogik

Buchungen müssen ausgeglichen sein (Soll = Haben). MySQL-`decimal`-Werte sind Strings — vor dem Rechnen konvertieren. MWST-Sätze aus den Org-Einstellungen, QR-/SCOR-Referenzen über `shared/qrReference.ts`. Freigegebene Buchungen und abgeschlossene Geschäftsjahre sind unveränderlich (GeBüV).

### Datenbankzugriff

Alle DB-Abfragen über Drizzle ORM. Schema-Änderungen in `drizzle/schema.ts` + Migration via `pnpm drizzle-kit generate` (Migration committen). Zusammengehörige Schreibzugriffe in einer Transaktion.

### API-Design

Neue Endpunkte als tRPC-Prozedur in `server/routers.ts` oder `server/<feature>Router.ts`, immer mit Zod-Input-Schema (kein `z.any()`). Client ruft nur über `trpc.*` auf.

### Komponenten & UI

Neue Seiten unter `client/src/pages/` und in `App.tsx` per `React.lazy` registrieren. Beträge mit `toLocaleString('de-CH')` formatieren.

### Code-Qualität

TypeScript `any` ist verboten — `unknown` mit Type Guard verwenden. `console.log()` verboten — `createLogger()` aus `server/_core/logger.ts`. Env-Variablen in `server/_core/env.ts` deklarieren und in `.env.example` dokumentieren. Vor Commit: `pnpm check` und `pnpm test`.

## Projektstruktur

```
client/src/
├── pages/            # Seiten (Dashboard, Journal, BankImport, Settings, …)
├── components/       # Shared UI (ui/ = shadcn-Primitives)
├── contexts/ hooks/  # FiscalYearContext, ThemeContext, useAuth
└── lib/              # trpc-Client, Formatierungs-Helfer
server/
├── _core/            # index.ts (Express-Bootstrap), trpc.ts, sdk.ts (Session), env.ts, logger.ts, publicUrl.ts, storageProxy.ts
├── routers.ts        # tRPC Root-Router (Journal, Bank, Belege, Berichte, …)
├── *Router.ts        # Feature-Router (auth, invoices, reminders, qrBill, yearEnd, settings, dsg, …)
├── db.ts             # Drizzle-Queries / Helfer
├── storage.ts        # Datei-Storage (Forge-Proxy oder lokal)
└── *.test.ts         # Vitest
shared/               # bankParser, camt054Parser, qrReference, currency, kmuKontenplan
drizzle/              # schema.ts, Migrationen (0000–00xx), meta/
scripts/              # e2e-core-chain.mjs, encrypt-existing-secrets.ts, reset-all-data.ts
```

## Wichtige Konventionen

- Dateinamen: PascalCase für Komponenten/Seiten, camelCase für Utilities und Router
- Alle Geldbeträge intern als `number` (CHF), Anzeige mit `toLocaleString('de-CH')`
- Fehler in tRPC: `TRPCError` mit passendem Code; in Express-Routen `{ error: string }` + HTTP-Status
- Logging: `createLogger("modul")`, strukturiert (`log.info({ feld }, "msg")`)
- Pflicht-Env: `DATABASE_URL`, `JWT_SECRET`; für Produktion zusätzlich `APP_URL`, `SECRETS_MASTER_KEY`, E-Mail-Provider

## Befehle

`pnpm dev` (Server + Vite HMR) · `pnpm check` (tsc) · `pnpm test` (Vitest) · `pnpm build` · `pnpm drizzle-kit migrate` · `pnpm test:core-chain` (E2E gegen laufenden Server)
