CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(10) NOT NULL,
	`name` varchar(200) NOT NULL,
	`accountType` enum('asset','liability','expense','revenue','equity') NOT NULL,
	`normalBalance` enum('debit','credit') NOT NULL,
	`category` varchar(100),
	`subCategory` varchar(100),
	`isBankAccount` boolean DEFAULT false,
	`isVatRelevant` boolean DEFAULT false,
	`defaultVatRate` decimal(5,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`iban` varchar(34),
	`bank` varchar(100),
	`currency` varchar(3) NOT NULL DEFAULT 'CHF',
	`owner` varchar(10),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankAccountId` int NOT NULL,
	`transactionDate` date NOT NULL,
	`valueDate` date,
	`amount` decimal(15,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'CHF',
	`description` text,
	`reference` varchar(100),
	`counterparty` varchar(200),
	`counterpartyIban` varchar(34),
	`importBatchId` varchar(50),
	`status` enum('pending','matched','ignored') NOT NULL DEFAULT 'pending',
	`journalEntryId` int,
	`suggestedDebitAccountId` int,
	`suggestedCreditAccountId` int,
	`aiConfidence` int,
	`aiReasoning` text,
	`txHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_transactions_txHash_unique` UNIQUE(`txHash`)
);
--> statement-breakpoint
CREATE TABLE `credit_card_statements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`statementDate` date NOT NULL,
	`totalAmount` decimal(15,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'CHF',
	`owner` varchar(10) DEFAULT 'mw',
	`status` enum('pending','approved') NOT NULL DEFAULT 'pending',
	`journalEntryId` int,
	`rawText` text,
	`parsedItems` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_card_statements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(10) NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`ahvNumber` varchar(20),
	`address` text,
	`dateOfBirth` date,
	`employmentStart` date,
	`salaryAccountId` int,
	`grossSalaryAccountId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `fiscal_years` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`isClosed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fiscal_years_id` PRIMARY KEY(`id`),
	CONSTRAINT `fiscal_years_year_unique` UNIQUE(`year`)
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryNumber` varchar(20),
	`bookingDate` date NOT NULL,
	`valueDate` date,
	`description` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`source` enum('manual','bank_import','credit_card','payroll','vat','system') NOT NULL DEFAULT 'manual',
	`sourceRef` varchar(100),
	`aiConfidence` int,
	`aiReasoning` text,
	`fiscalYear` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryId` int NOT NULL,
	`accountId` int NOT NULL,
	`side` enum('debit','credit') NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`description` text,
	`vatAmount` decimal(15,2),
	`vatRate` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opening_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`fiscalYear` int NOT NULL,
	`balance` decimal(15,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opening_balances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payroll_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`grossSalary` decimal(15,2) NOT NULL,
	`ahvEmployee` decimal(15,2) DEFAULT '0',
	`ahvEmployer` decimal(15,2) DEFAULT '0',
	`bvgEmployee` decimal(15,2) DEFAULT '0',
	`bvgEmployer` decimal(15,2) DEFAULT '0',
	`ktgUvgEmployee` decimal(15,2) DEFAULT '0',
	`ktgUvgEmployer` decimal(15,2) DEFAULT '0',
	`netSalary` decimal(15,2) NOT NULL,
	`totalEmployerCost` decimal(15,2) NOT NULL,
	`status` enum('draft','approved','paid') NOT NULL DEFAULT 'draft',
	`journalEntryId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vat_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`period` varchar(5) NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`turnover81` decimal(15,2) DEFAULT '0',
	`turnover26` decimal(15,2) DEFAULT '0',
	`turnover38` decimal(15,2) DEFAULT '0',
	`turnoverExempt` decimal(15,2) DEFAULT '0',
	`vatDue81` decimal(15,2) DEFAULT '0',
	`vatDue26` decimal(15,2) DEFAULT '0',
	`vatDue38` decimal(15,2) DEFAULT '0',
	`inputTax` decimal(15,2) DEFAULT '0',
	`netVatPayable` decimal(15,2) DEFAULT '0',
	`status` enum('open','submitted','paid') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vat_periods_id` PRIMARY KEY(`id`)
);
