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
ALTER TABLE `year_end_bookings` ADD `organizationId` int;