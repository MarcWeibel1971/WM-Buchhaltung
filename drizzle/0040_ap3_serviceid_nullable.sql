ALTER TABLE `time_entries` MODIFY COLUMN `serviceId` int;--> statement-breakpoint
-- AP3.7: Bestehende 0-Platzhalter zu NULL normalisieren
UPDATE `time_entries` SET `serviceId` = NULL WHERE `serviceId` = 0;
