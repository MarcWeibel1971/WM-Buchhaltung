-- ─── Phase 0 GeBüV: Fortlaufende Belegnummern pro Geschäftsjahr ─────────────
-- Migration 0099 (Claude / Phase 0 Code-Review Recommendations).
-- Hohe Nummer, um nicht mit Manus' feature-Migrationen (0018-0098) zu
-- kollidieren, die noch kommen können.

-- 1) Sequenz-Tabelle für fortlaufende Belegnummern pro Geschäftsjahr.
--    Nutzt MySQL's LAST_INSERT_ID()-Trick für atomare Allokation ohne
--    Row-Level-Locking – sicher unter Concurrent Inserts.
CREATE TABLE `journal_entry_sequences` (
	`fiscalYear` int NOT NULL,
	`nextSequence` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journal_entry_sequences_fiscalYear` PRIMARY KEY(`fiscalYear`)
);
--> statement-breakpoint

-- 2) Backfill: bestehende approved Entries bekommen fortlaufende Nummern
--    im Format BL-YYYY-NNNNN, sortiert nach (bookingDate, id) pro Jahr.
UPDATE `journal_entries` je
INNER JOIN (
	SELECT
		id,
		CONCAT(
			'BL-',
			LPAD(COALESCE(fiscalYear, YEAR(bookingDate)), 4, '0'),
			'-',
			LPAD(
				ROW_NUMBER() OVER (
					PARTITION BY COALESCE(fiscalYear, YEAR(bookingDate))
					ORDER BY bookingDate, id
				),
				5, '0'
			)
		) AS newNumber
	FROM `journal_entries`
	WHERE status = 'approved'
) ranked ON ranked.id = je.id
SET je.entryNumber = ranked.newNumber
WHERE je.status = 'approved';
--> statement-breakpoint

-- 3) Sequenz-Tabelle mit MAX+1 pro Jahr initialisieren.
INSERT INTO `journal_entry_sequences` (`fiscalYear`, `nextSequence`)
SELECT
	COALESCE(fiscalYear, YEAR(bookingDate)) AS fy,
	COUNT(*) + 1 AS nextSeq
FROM `journal_entries`
WHERE status = 'approved'
GROUP BY COALESCE(fiscalYear, YEAR(bookingDate));
--> statement-breakpoint

-- 4) Unique-Index auf entryNumber (NULL-Werte sind in MySQL mehrfach
--    erlaubt, sodass pending Entries ohne Nummer existieren können).
CREATE UNIQUE INDEX `journal_entries_entryNumber_unique` ON `journal_entries` (`entryNumber`);
