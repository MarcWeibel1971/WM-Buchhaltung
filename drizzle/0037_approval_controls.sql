-- Phase 2.3+2.4: Prozesskontrollen (Vier-Augen-Prinzip) und Storno-Verknüpfung
-- organizations.requireFourEyesApproval: Freigabe muss durch zweite Person erfolgen.
-- journal_entries.createdBy: Ersteller des Eintrags (für Ersteller ≠ Prüfer).
-- journal_entries.reversalOfEntryId / reversedByEntryId: bilaterale Storno-Verknüpfung.
ALTER TABLE `organizations` ADD `requireFourEyesApproval` boolean DEFAULT false NOT NULL;
ALTER TABLE `journal_entries` ADD `createdBy` int;
ALTER TABLE `journal_entries` ADD `reversalOfEntryId` int;
ALTER TABLE `journal_entries` ADD `reversedByEntryId` int;
