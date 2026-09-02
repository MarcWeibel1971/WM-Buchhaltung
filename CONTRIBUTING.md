# Contribution-Guide

Richtlinien für Beiträge zu WM-Buchhaltung. Der wichtigste Teil betrifft
**Datenbank-Migrationen** – Fehler dort fallen erst in Produktion auf und sind
schwer rückgängig zu machen.

## Datenbank-Migrationen (Schema-Disziplin)

### Grundregeln

1. **Gemergte Migrationen sind unveränderlich.** Eine Migration, die auf `main`
   liegt oder irgendwo angewendet wurde, wird nie editiert. Fehler werden mit
   einer **neuen** Migration korrigiert («fix forward»).
2. **Jede Schema-Änderung läuft über `drizzle/schema.ts`.** Keine handgeschriebenen
   DDL-Änderungen am Schema vorbei – sonst laufen Snapshot und Datenbank auseinander.
3. **Jede Migration muss auf einer leeren Datenbank von 0000 an durchlaufen**
   (Fresh-Chain-Test) **und** auf einer bestehenden Datenbank als Update.
4. **Destruktive Änderungen (DROP, UNIQUE, NOT NULL) brauchen Guards und
   Daten-Normalisierung** – siehe unten.

### Workflow

```bash
# 1. Schema ändern
$EDITOR drizzle/schema.ts

# 2. Migration generieren
pnpm drizzle-kit generate

# 3. Generiertes SQL LESEN und prüfen (drizzle-kit sieht keine Daten!)
#    - stimmen die Spalten-/Index-Namen?
#    - DROP/UNIQUE/NOT NULL auf Tabellen mit Bestandsdaten? → Guard nötig
#    - `--> statement-breakpoint` zwischen allen Statements vorhanden?

# 4. Fresh-Chain-Test (leere DB, komplette Kette)
mysql -e "CREATE DATABASE test_fresh"
DATABASE_URL=mysql://user:pass@host/test_fresh pnpm drizzle-kit migrate

# 5. Update-Test (DB mit Daten des aktuellen Stands)
DATABASE_URL=mysql://user:pass@host/bestehende_db pnpm drizzle-kit migrate

# 6. Tests + Typsicherheit
pnpm check && pnpm test
```

### MySQL-8-Fallen (aus echten Incidents)

- **Kein `DROP INDEX IF EXISTS`.** MySQL 8 kennt das nicht – ein ungeschütztes
  `DROP INDEX` bricht die Migration, wenn der Index (noch) existiert oder schon
  fehlt. Stattdessen den Guard über `information_schema` verwenden:

  ```sql
  SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal_entries'
      AND INDEX_NAME = 'journal_entries_entryNumber_unique');
  --> statement-breakpoint
  SET @sql := IF(@idx > 0,
    'ALTER TABLE `journal_entries` DROP INDEX `journal_entries_entryNumber_unique`',
    'SELECT 1');
  --> statement-breakpoint
  PREPARE stmt FROM @sql;
  --> statement-breakpoint
  EXECUTE stmt;
  --> statement-breakpoint
  DEALLOCATE PREPARE stmt;
  --> statement-breakpoint
  ```

- **drizzle-kit sieht keine Bestandsdaten.** Ein `UNIQUE`-Constraint auf einer
  befüllten Spalte oder `NOT NULL` ohne Default schlägt in Produktion fehl.
  Lösung: erst Daten normalisieren (`UPDATE ... WHERE ...`), dann Constraint –
  in derselben Migration, in dieser Reihenfolge.
- **`--> statement-breakpoint` ist Pflicht** zwischen Statements; sonst führt
  der Migrator mehrere Statements als eines aus und MySQL bricht ab.
- **Kommentare im generierten SQL lügen nicht mit.** Wenn ein Kommentar sagt
  «wurde in Migration X entfernt», muss das in X auch wirklich passieren.
  (Incident AP2: Der globale Unique-Index `journal_entries_entryNumber_unique`
  wurde laut Kommentar in 0020 gedroppt, tatsächlich nie – Frischinstallationen
  knallten bei der zweiten Organisation. Gefixt per Guard in 0039.)
- **Daten-Migrationen immer guarden** (`IF`, `INSERT IGNORE`, `WHERE NOT EXISTS`),
  damit sie auf jeder Ausgangslage idempotent-fehlerfrei durchlaufen.
- **`drizzle/meta/_journal.json` + Snapshot nie von Hand pflegen**, wenn
  `drizzle-kit generate` die Dateien erzeugen kann. Handeingriffe nur für reine
  Daten-Migrationen (Snapshot = Kopie des Vorgängers mit neuer `id`/`prevId`).

### Vor jedem PR

- [ ] `pnpm check` (tsc) sauber
- [ ] `pnpm test` grün
- [ ] `pnpm build` erfolgreich
- [ ] Fresh-Chain-Test aller Migrationen auf leerer DB
- [ ] Bei Schema-Änderung: Update-Pfad auf befüllter DB getestet

## Code-Stil (Kurzfassung)

- TypeScript strict, keine neuen `any` ohne Begründung im Kommentar.
- Fehlermeldungen für Anwender: Deutsch, Sie-Form, mit Ursache + Lösungshinweis.
- tRPC-Mutations, die Daten ändern, invalidieren clientseitig alle betroffenen
  Queries (nicht nur die eigene Liste).
