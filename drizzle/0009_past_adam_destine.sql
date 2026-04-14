CREATE TABLE `depreciation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`depreciationRate` decimal(5,2) NOT NULL,
	`method` enum('linear','degressive') NOT NULL DEFAULT 'degressive',
	`usefulLifeYears` int,
	`depreciationExpenseAccountId` int,
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `depreciation_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `year_end_bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fiscalYear` int NOT NULL,
	`bookingType` enum('transitorische_aktiven','transitorische_passiven','kreditoren','debitoren','abschreibung','rueckbuchung') NOT NULL,
	`description` text NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`debitAccountId` int NOT NULL,
	`creditAccountId` int NOT NULL,
	`sourceDocumentId` int,
	`sourceJournalEntryId` int,
	`journalEntryId` int,
	`reversalEntryId` int,
	`status` enum('suggested','approved','rejected') NOT NULL DEFAULT 'suggested',
	`aiReasoning` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `year_end_bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `fiscal_years` ADD `status` enum('open','closing','closed') DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE `fiscal_years` ADD `balanceCarriedForward` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `fiscal_years` ADD `closedAt` timestamp;