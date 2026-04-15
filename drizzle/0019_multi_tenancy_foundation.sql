CREATE TABLE `journal_entry_sequences` (
	`organizationId` int NOT NULL,
	`fiscalYear` int NOT NULL,
	`nextSequence` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journal_entry_sequences_organizationId_fiscalYear_pk` PRIMARY KEY(`organizationId`,`fiscalYear`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`legalForm` varchar(50),
	`street` varchar(200),
	`zipCode` varchar(10),
	`city` varchar(100),
	`canton` varchar(50),
	`country` varchar(50) DEFAULT 'Schweiz',
	`uid` varchar(20),
	`hrNumber` varchar(50),
	`vatNumber` varchar(30),
	`vatMethod` enum('effective','saldo','pauschal') DEFAULT 'effective',
	`vatSaldoRate` decimal(5,2) DEFAULT '0',
	`vatPeriod` enum('quarterly','semi-annual') DEFAULT 'quarterly',
	`fiscalYearStartMonth` int DEFAULT 1,
	`phone` varchar(30),
	`email` varchar(200),
	`website` varchar(200),
	`logoUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int NOT NULL,
	`role` enum('owner','admin','bookkeeper','viewer') NOT NULL DEFAULT 'viewer',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts` DROP INDEX `accounts_number_unique`;--> statement-breakpoint
ALTER TABLE `employees` DROP INDEX `employees_code_unique`;--> statement-breakpoint
ALTER TABLE `fiscal_years` DROP INDEX `fiscal_years_year_unique`;--> statement-breakpoint
ALTER TABLE `company_settings` MODIFY COLUMN `companyName` varchar(200) NOT NULL DEFAULT 'Meine Firma';--> statement-breakpoint
ALTER TABLE `accounts` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `booking_rules` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `credit_card_statements` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `customer_services` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `depreciation_settings` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `documents` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `employees` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `fiscal_years` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `import_history` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `insurance_settings` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `journal_entries` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `opening_balances` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `pain001_exports` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `pain001_payments` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `payroll_entries` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `qr_settings` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `services` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `templates` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `currentOrganizationId` int;--> statement-breakpoint
ALTER TABLE `vat_periods` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `year_end_bookings` ADD `organizationId` int;--> statement-breakpoint

-- ─── Phase 1 Multi-Tenancy: Daten-Migration für bestehende Single-Tenant-DB ──
-- Legt eine Default-Organisation an, verknüpft alle User damit und weist alle
-- bestehenden Domain-Zeilen der Default-Org zu. Nach dieser Migration sind
-- alle Daten genau einer Organisation zugeordnet; Phase 1c setzt organizationId
-- dann NOT NULL.

-- 1) Default-Organisation aus companySettings ableiten (Fallback: "Standardmandant").
INSERT INTO `organizations` (
	`id`, `name`, `slug`, `legalForm`, `street`, `zipCode`, `city`, `canton`,
	`country`, `uid`, `hrNumber`, `vatNumber`, `vatMethod`, `vatSaldoRate`,
	`vatPeriod`, `fiscalYearStartMonth`, `phone`, `email`, `website`
)
SELECT
	1,
	COALESCE(cs.companyName, 'Standardmandant'),
	'default',
	cs.legalForm,
	cs.street, cs.zipCode, cs.city, cs.canton,
	COALESCE(cs.country, 'Schweiz'),
	cs.uid, cs.hrNumber, cs.vatNumber,
	COALESCE(cs.vatMethod, 'effective'),
	COALESCE(cs.vatSaldoRate, 0),
	COALESCE(cs.vatPeriod, 'quarterly'),
	COALESCE(cs.fiscalYearStartMonth, 1),
	cs.phone, cs.email, cs.website
FROM (SELECT 1) x
LEFT JOIN `company_settings` cs ON 1=1
LIMIT 1
ON DUPLICATE KEY UPDATE `id` = `id`;
--> statement-breakpoint

-- Fallback: falls keine Zeile eingefügt wurde (leerer Table), explizit anlegen.
INSERT IGNORE INTO `organizations` (`id`, `name`, `slug`)
VALUES (1, 'Standardmandant', 'default');
--> statement-breakpoint

-- 2) Jeder existierende User wird Owner der Default-Org und bekommt sie als
--    currentOrganization gesetzt.
INSERT IGNORE INTO `user_organizations` (`userId`, `organizationId`, `role`)
SELECT `id`, 1, 'owner' FROM `users`;
--> statement-breakpoint

UPDATE `users` SET `currentOrganizationId` = 1 WHERE `currentOrganizationId` IS NULL;
--> statement-breakpoint

-- 3) Backfill organizationId=1 auf ALLEN Domain-Tabellen.
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

-- ─── Phase 0 Nachzug: Belegnummern-Backfill + Unique-Index ──────────────────
-- Die Sequenz-Tabelle wurde in Phase 0 geplant, aber erst jetzt angelegt
-- (mit Composite-PK inkl. organizationId). Wir backfillen existierende
-- approved Journal-Einträge mit lückenlosen Nummern pro (orgId, Geschäftsjahr).
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
					PARTITION BY organizationId, COALESCE(fiscalYear, YEAR(bookingDate))
					ORDER BY bookingDate, id
				),
				5, '0'
			)
		) AS newNumber
	FROM `journal_entries`
	WHERE status = 'approved'
) ranked ON ranked.id = je.id
SET je.entryNumber = ranked.newNumber
WHERE je.status = 'approved'
	AND (je.entryNumber IS NULL OR je.entryNumber = '');
--> statement-breakpoint

-- Sequenz-Tabelle pro (organizationId, fiscalYear) initialisieren.
INSERT INTO `journal_entry_sequences` (`organizationId`, `fiscalYear`, `nextSequence`)
SELECT
	organizationId,
	COALESCE(fiscalYear, YEAR(bookingDate)) AS fy,
	COUNT(*) + 1 AS nextSeq
FROM `journal_entries`
WHERE status = 'approved'
GROUP BY organizationId, COALESCE(fiscalYear, YEAR(bookingDate))
ON DUPLICATE KEY UPDATE `nextSequence` = VALUES(`nextSequence`);
--> statement-breakpoint

-- Unique-Index auf entryNumber (NULL mehrfach erlaubt für pending Drafts).
-- Multi-Tenant-sauber wäre (organizationId, entryNumber), aber solange
-- entryNumber bereits den Jahr-Präfix enthält, bleibt es global eindeutig.
CREATE UNIQUE INDEX `journal_entries_entryNumber_unique` ON `journal_entries` (`entryNumber`);