-- ─── Phase 1c: organizationId NOT NULL + Composite Unique Keys ───────────────
-- Sichert Multi-Tenancy auf Schema-Ebene: keine Zeile kann mehr ohne
-- Organisation existieren, und org-spezifische Unique-Constraints
-- (Kontonummer, Employee-Code, Fiscal Year, Belegnummer) gelten pro Mandant.

-- ─── Safety Net: falls noch Zeilen ohne organizationId existieren (sollte
-- nach 0019 nicht mehr vorkommen), werden sie der Default-Org (id=1) zugewiesen.
UPDATE `accounts`                SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `audit_log`               SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `bank_accounts`           SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `bank_transactions`       SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `booking_rules`           SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `company_settings`        SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `credit_card_statements`  SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `customer_services`       SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `customers`               SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `depreciation_settings`   SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `documents`               SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `employees`               SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `fiscal_years`            SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `import_history`          SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `insurance_settings`      SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `journal_entries`         SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `opening_balances`        SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `pain001_exports`         SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `pain001_payments`        SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `payroll_entries`         SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `qr_settings`             SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `services`                SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `suppliers`               SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `templates`               SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `time_entries`            SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `vat_periods`             SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint
UPDATE `year_end_bookings`       SET `organizationId` = 1 WHERE `organizationId` IS NULL;
--> statement-breakpoint

-- ─── Globalen entryNumber-Unique-Index droppen (war aus 0019) ──────────────
-- Wird durch den neuen (organizationId, entryNumber) Composite-Index ersetzt.
-- HINWEIS: Index wurde bereits durch Migration 0020 entfernt, daher hier auskommentiert.
-- DROP INDEX `journal_entries_entryNumber_unique` ON `journal_entries`;
SELECT 1;
--> statement-breakpoint

-- ─── NOT NULL Constraints ──────────────────────────────────────────────────
ALTER TABLE `accounts` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_log` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_accounts` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_transactions` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_rules` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `credit_card_statements` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_services` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `depreciation_settings` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `fiscal_years` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `import_history` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `insurance_settings` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `journal_entries` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `opening_balances` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `pain001_exports` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `pain001_payments` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `payroll_entries` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `qr_settings` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `services` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `templates` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `time_entries` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `vat_periods` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `year_end_bookings` MODIFY COLUMN `organizationId` int NOT NULL;--> statement-breakpoint

-- ─── Composite Unique Constraints ──────────────────────────────────────────
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_org_number_unique` UNIQUE(`organizationId`,`number`);--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_org_code_unique` UNIQUE(`organizationId`,`code`);--> statement-breakpoint
ALTER TABLE `fiscal_years` ADD CONSTRAINT `fiscal_years_org_year_unique` UNIQUE(`organizationId`,`year`);--> statement-breakpoint
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_org_entryNumber_unique` UNIQUE(`organizationId`,`entryNumber`);
