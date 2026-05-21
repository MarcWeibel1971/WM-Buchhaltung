# FinanzPlan — Claude Code Instructions

> Dieses File wird von Rippletide verwaltet. Manuelle Änderungen werden beim nächsten `npx rippletide-code` überschrieben.
> Regeln bearbeiten: `.rippletide/selected-rules.md`

## Projekt-Übersicht

**App:** pensionierung-plus.ch — Schweizer Finanzplanungs-SaaS für Berater
**Stack:** Next.js 16 · TypeScript 5.9 · Drizzle ORM · Clerk · oRPC · Zod · Railway · PostgreSQL
**Sprache:** Deutsch (UI + Code-Kommentare)

## Kritische Regeln (werden bei jedem Commit geprüft)

### Authentifizierung & Mandantentrennung

Jede API-Route MUSS `auth()` von `@clerk/nextjs/server` aufrufen. Bei fehlendem `userId` oder `orgId` MUSS mit Status 401 geantwortet werden. Der `orgId` darf NICHT aus dem Request-Body gelesen werden — immer aus `auth()`. Datenbankabfragen MÜSSEN immer `organizationId` als Filter enthalten.

### Steuerberechnungen

Alle Steuerberechnungen laufen über `berechneEinkommenssteuer()` aus `@/modules/steuer`. BVG über `berechneBvgRente()`, AHV über `berechneAhvRente()`. Niemals inline oder mit eigenen Formeln rechnen. Steuer-Inputs verwenden den `TaxInput`-Typ.

### Datenbankzugriff

Alle DB-Abfragen über Drizzle ORM — kein raw SQL. Neue DB-Operationen gehören in einen Service unter `src/services/`. Schema-Änderungen in `src/models/Schema.ts` + neue Migration.

### API-Design

Neue Mutations als oRPC-Procedure in `src/routers/` — keine direkten `fetch()`-Aufrufe zu eigenen API-Routen. Alle Procedures mit Zod-Schemas. Externe API-Routen mit `EXTERN_API_KEY` sichern.

### Komponenten & UI

Finanzielle Beträge mit `toLocaleString('de-CH')` formatieren. Alle user-facing Strings über `next-intl`. Neue Seiten brauchen `loading.tsx`. Neue Komponenten in `src/components/` oder `src/features/<name>/`.

### Code-Qualität

TypeScript `any` ist verboten — `unknown` mit Type Guard verwenden. `console.log()` in Produktionscode verboten. Benutzereingaben vor DB-Operationen mit Zod validieren. Env-Variablen in `src/libs/Env.ts` deklarieren.

## Projektstruktur

```
src/
├── app/[locale]/          # Next.js App Router (Seiten)
├── app/api/               # API-Routen (admin/, extern/, mcp/, portal/)
├── components/            # Shared UI-Komponenten
├── features/              # Feature-Module (kunden/, vermoegen/, etc.)
├── libs/                  # Utilities (Env.ts, DB.ts, McpServer.ts)
├── models/                # Drizzle Schema (Schema.ts)
├── modules/               # Business-Logik (steuer/, ahv/, bvg/, vorsorge/)
├── routers/               # oRPC-Router
└── services/              # Datenbankzugriff-Services
```

## Wichtige Konventionen

- Dateinamen: PascalCase für Klassen/Komponenten, camelCase für Utilities
- Services exportieren Funktionen (nicht Klassen)
- Alle Geldbeträge intern als `number` (CHF), Anzeige mit `toLocaleString('de-CH')`
- Fehler in API-Routen: `{ error: string }` mit passendem HTTP-Status
- Neue Features: immer unter `src/features/<feature-name>/`

## MCP-Server

Der Finanzplan MCP-Server läuft unter `/api/mcp`. Dokumentation: `docs/mcp-server.md`.
Tools: `list_kunden`, `get_kunde`, `get_vermoegen`, `get_cashflow`, `get_vorsorge`, `berechne_steuer`, `berechne_ahv`, `berechne_bvg`, `get_pk_kennzahlen`.
