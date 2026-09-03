# Rippletide — Ausgewählte Regeln für WM-Buchhaltung (KLAX)

Stack: React 19 · Vite 7 · TypeScript 5.9 · Express 4 · tRPC 11 · Drizzle ORM (MySQL 8) · Zod 4 · Vitest

> Audit 2026-09: Die zuvor hier hinterlegten Regeln stammten aus einem anderen
> Projekt (FinanzPlan / Next.js / Clerk / oRPC) und passten nicht zu diesem Repo.

---

## 🔒 Authentifizierung & Mandantentrennung

- Jede tRPC-Prozedur, die organisationsbezogene Daten liest oder schreibt, MUSS `orgProcedure` aus `server/_core/trpc.ts` verwenden und `ctx.organizationId` in JEDEM WHERE-Filter einsetzen (`protectedProcedure` reicht nicht).
- Verwaltungsfunktionen (Benutzer, Rollen, Org-Einstellungen, DSG-Export/-Anonymisierung, Datenlöschung) MÜSSEN `adminProcedure` verwenden.
- `organizationId` und `userId` DÜRFEN NICHT aus dem Input gelesen werden — immer aus `ctx`.
- Express-Routen ausserhalb von tRPC (Upload, Storage-Proxy, Webhooks) MÜSSEN `sdk.authenticateRequest(req)` aufrufen oder eine Signatur (Stripe/POS) verifizieren.
- Links in E-Mails (Verifizierung, Reset, Einladung) MÜSSEN über `resolvePublicOrigin()` aus `server/_core/publicUrl.ts` gebaut werden — niemals `input.origin` direkt.

## 🧮 Buchhaltungslogik

- Jede Buchung MUSS ausgeglichen sein (Summe Soll = Summe Haben, auf 0.01 gerundet) — serverseitig prüfen, nicht nur im Client.
- Beträge werden intern als `number` in CHF geführt; MySQL-`decimal`-Spalten liefern Strings und MÜSSEN mit `Number()`/`parseFloat()` konvertiert werden, bevor gerechnet wird.
- MWST-Sätze (8.1 / 2.6 / 3.8 %) und Saldosteuersätze kommen aus den Org-Einstellungen bzw. `shared/`-Konstanten — keine Hardcodes in Komponenten oder Routern.
- QR-/SCOR-Referenzen MÜSSEN mit `shared/qrReference.ts` validiert werden.
- Freigegebene Buchungen und abgeschlossene Geschäftsjahre DÜRFEN NICHT verändert werden (GeBüV) — Korrekturen nur per Stornobuchung.

## 🗄️ Datenbankzugriff

- Alle Datenbankabfragen MÜSSEN über Drizzle ORM laufen; `sql\`\`` nur für Aggregationen ohne interpolierte Benutzereingaben.
- Wiederverwendbare Abfragen gehören nach `server/db.ts` bzw. in den jeweiligen Feature-Router (`server/<feature>Router.ts`).
- Schema-Änderungen MÜSSEN in `drizzle/schema.ts` erfolgen und eine Migration via `pnpm drizzle-kit generate` erzeugen (Migration ins Repo committen).
- Mehrere zusammengehörige Schreibzugriffe (z. B. Buchung + Zeilen, Nummernkreise) MÜSSEN in einer Transaktion laufen.

## 📡 API-Design (tRPC)

- Neue Mutations/Queries MÜSSEN als tRPC-Prozedur in `server/routers.ts` oder einem `server/<feature>Router.ts` definiert werden.
- Alle Prozeduren MÜSSEN Zod-Schemas für den Input verwenden; `z.any()` ist verboten.
- Der Client ruft ausschliesslich über `trpc.*` (`client/src/lib/trpc.ts`) auf — keine direkten `fetch()`-Aufrufe auf eigene tRPC-Routen (Ausnahme: `/api/upload/*` per FormData).

## 🧩 Komponenten & UI

- Neue Seiten unter `client/src/pages/`, in `client/src/App.tsx` per `React.lazy` registrieren.
- Shared UI-Komponenten unter `client/src/components/`, shadcn-Primitives unter `client/src/components/ui/`.
- Finanzielle Beträge MÜSSEN mit `toLocaleString('de-CH')` bzw. den Helfern in `client/src/lib/` formatiert werden — niemals `toFixed()` direkt für Währungsanzeige.
- Sprache der UI ist Deutsch (Schweiz): «ss» statt «ß», Apostroph als Tausendertrennzeichen.

## 🧪 Qualität & Tests

- Neue Server-Logik (Parser, Berechnungen, Matching) MUSS eine `.test.ts`-Datei haben (Vitest, `pnpm test`).
- TypeScript `any` ist verboten — stattdessen `unknown` mit Type Guard oder explizite Typen verwenden.
- `console.log()` ist in Produktionscode verboten — `createLogger("<modul>")` aus `server/_core/logger.ts` verwenden.
- Vor jedem Commit: `pnpm check` (tsc) und `pnpm test` müssen grün sein.

## 📁 Dateistruktur

- `client/` React-Frontend, `server/` Express/tRPC-Backend, `shared/` zwischen beiden geteilter Code (Parser, Konstanten, Typen), `drizzle/` Schema + Migrationen, `scripts/` CLI-Helfer.
- Env-Variablen MÜSSEN in `server/_core/env.ts` (`ENV`) deklariert und in `.env.example` dokumentiert werden — kein `process.env.XYZ` verstreut im Code.

## 🔐 Sicherheit

- Keine Secrets oder API-Keys in Kommentaren, Logs oder Fehlermeldungen; Secrets at-rest über `server/secrets.ts` (AES-256-GCM, `SECRETS_MASTER_KEY`).
- Benutzereingaben MÜSSEN vor DB-Operationen mit Zod validiert werden.
- Webhooks (Stripe, POS) MÜSSEN die Signatur über den Raw-Body prüfen, bevor Daten verändert werden.
- Destruktive Skripte (`scripts/reset-all-data.ts`) MÜSSEN in `NODE_ENV=production` abbrechen.
