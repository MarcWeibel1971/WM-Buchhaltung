# Rippletide — Ausgewählte Regeln für FinanzPlan (pensionierung-plus.ch)

Stack: Next.js 16 · TypeScript 5.9 · Drizzle ORM · Clerk · oRPC · Zod · Railway

---

## 🔒 Authentifizierung & Mandantentrennung

- Jede API-Route (App Router) MUSS `auth()` von `@clerk/nextjs/server` aufrufen und bei fehlendem `userId` oder `orgId` mit `NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })` antworten.
- Datenbankabfragen MÜSSEN immer `organizationId` als Filter enthalten — niemals Daten ohne Mandantenfilter abfragen.
- Der `orgId` aus Clerk DARF NICHT aus dem Request-Body gelesen werden — immer aus `auth()`.

## 🧮 Steuerberechnungen

- Alle Steuerberechnungen MÜSSEN über `berechneEinkommenssteuer()` aus `@/modules/steuer` laufen — niemals inline oder mit eigenen Formeln.
- BVG-Berechnungen MÜSSEN `berechneBvgRente()` aus `@/modules/steuer` verwenden.
- AHV-Berechnungen MÜSSEN `berechneAhvRente()` aus `@/modules/steuer` verwenden.
- Steuer-Inputs MÜSSEN den `TaxInput`-Typ aus `@/modules/steuer` verwenden.

## 🗄️ Datenbankzugriff

- Alle Datenbankabfragen MÜSSEN über Drizzle ORM laufen — kein raw SQL (`db.execute()` ist verboten ausser in Migrations).
- Neue Datenbankoperationen MÜSSEN in einem Service unter `src/services/` gekapselt sein — keine direkten DB-Aufrufe in API-Routen oder Komponenten.
- Schema-Änderungen MÜSSEN in `src/models/Schema.ts` erfolgen und eine neue Drizzle-Migration erzeugen.

## 📡 API-Design (oRPC)

- Neue Mutations MÜSSEN als oRPC-Procedure in `src/routers/` definiert werden — keine direkten `fetch()`-Aufrufe zu eigenen API-Routen aus Komponenten.
- Alle oRPC-Procedures MÜSSEN Zod-Schemas für Input und Output verwenden.
- Externe API-Routen (unter `src/app/api/extern/`) MÜSSEN mit `EXTERN_API_KEY` aus `Env.ts` gesichert sein.

## 🧩 Komponenten & UI

- Neue UI-Komponenten MÜSSEN in `src/components/` oder im zugehörigen Feature-Verzeichnis unter `src/features/` abgelegt werden.
- Jede neue Seite unter `src/app/` MUSS eine `loading.tsx` im gleichen Verzeichnis haben.
- Finanzielle Beträge MÜSSEN mit `toLocaleString('de-CH')` formatiert werden — niemals `toFixed()` direkt für Währungsanzeige.

## 🌍 Internationalisierung

- Alle user-facing Strings MÜSSEN über `next-intl` übersetzt werden — keine hardcodierten deutschen oder englischen Texte in Komponenten.
- Neue Routen MÜSSEN unter `src/app/[locale]/` angelegt werden.

## 🧪 Qualität & Tests

- Neue Service-Funktionen MÜSSEN eine entsprechende `.test.ts`-Datei haben (Vitest).
- TypeScript `any` ist verboten — stattdessen `unknown` mit Type Guard oder explizite Typen verwenden.
- `console.log()` ist in Produktionscode verboten — stattdessen strukturiertes Logging oder Kommentar mit `// TODO: remove`.

## 📁 Dateistruktur

- Neue Features MÜSSEN unter `src/features/<feature-name>/` abgelegt werden.
- Shared Utilities gehören nach `src/utils/`, shared Hooks nach `src/hooks/`.
- Env-Variablen MÜSSEN in `src/libs/Env.ts` mit `createEnv()` deklariert werden — kein direktes `process.env.XYZ` ausserhalb von `Env.ts`.

## 🔐 Sicherheit

- Keine Secrets oder API-Keys in Kommentaren, Logs oder Fehlermeldungen.
- Benutzereingaben MÜSSEN vor DB-Operationen mit Zod validiert werden.
- Clerk-Webhooks MÜSSEN mit `svix` verifiziert werden.
