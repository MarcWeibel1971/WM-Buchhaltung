# /plan — Implementierungsplan mit Regel-Review

Wenn der Benutzer `/plan` aufruft, erstelle einen detaillierten Implementierungsplan für die gewünschte Funktion und prüfe ihn gegen die aktiven Rippletide-Regeln.

## Ablauf

1. **Verstehe die Anforderung** — Was soll gebaut werden? Welche Teile des Systems sind betroffen?

2. **Erstelle den Plan** mit folgenden Abschnitten:
   - Betroffene Dateien (neu / geändert)
   - Datenbankänderungen (Schema, Migrations)
   - API-Änderungen (neue Routes, oRPC-Procedures)
   - UI-Änderungen (Komponenten, Seiten)
   - Tests

3. **Prüfe gegen Regeln** aus `.rippletide/selected-rules.md`:
   - Auth-Checks vorhanden?
   - Steuerberechnungen über Module?
   - Drizzle ORM statt raw SQL?
   - Zod-Validierung für Inputs?
   - Env-Variablen in Env.ts?

4. **Markiere Verstösse** mit ⚠️ und schlage Korrekturen vor.

5. **Warte auf Bestätigung** bevor du mit der Implementierung beginnst.

## Beispiel

Benutzer: `/plan Neue Seite für BVG-Einkauf-Rechner`

Claude erstellt Plan → prüft Regeln → zeigt Ergebnis → wartet auf "OK" → implementiert.
