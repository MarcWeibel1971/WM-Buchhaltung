-- Phase 3b: Mahn-Policy pro Organisation
-- Fügt 9 neue Spalten für die 3-stufige Mahn-Konfiguration hinzu.
-- Defaults spiegeln den bisher hardcodierten Policy-Stand wider.

ALTER TABLE `organizations`
  ADD COLUMN `reminderLevel1Days` int NOT NULL DEFAULT 15,
  ADD COLUMN `reminderLevel1Fee` decimal(15,2) NOT NULL DEFAULT '0',
  ADD COLUMN `reminderLevel1Grace` int NOT NULL DEFAULT 10,
  ADD COLUMN `reminderLevel2Days` int NOT NULL DEFAULT 30,
  ADD COLUMN `reminderLevel2Fee` decimal(15,2) NOT NULL DEFAULT '20',
  ADD COLUMN `reminderLevel2Grace` int NOT NULL DEFAULT 10,
  ADD COLUMN `reminderLevel3Days` int NOT NULL DEFAULT 60,
  ADD COLUMN `reminderLevel3Fee` decimal(15,2) NOT NULL DEFAULT '40',
  ADD COLUMN `reminderLevel3Grace` int NOT NULL DEFAULT 7;
