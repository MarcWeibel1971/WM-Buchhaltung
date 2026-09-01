-- AP2 / Datenintegritaet: Globalen Unique-Index auf journal_entries.entryNumber
-- entfernen (aus 0019). Die Belegnummer ist seit 0021 pro Organisation eindeutig
-- (journal_entries_org_entryNumber_unique). Der globale Index wurde in 0021
-- faelschlicherweise als "bereits entfernt" kommentiert – frische Installationen
-- behielten ihn, wodurch ab der zweiten Organisation das Verbuchen von Belegen
-- mit derselben Nummer (z. B. BL-2026-00001) an einem Duplicate-Key-Fehler
-- scheiterte. Guarded, damit die Migration auf Datenbestaenden idempotent ist.
SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'journal_entries'
    AND INDEX_NAME = 'journal_entries_entryNumber_unique'
);
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
