CREATE TABLE `customer_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`description` varchar(300) NOT NULL,
	`revenueAccountId` int NOT NULL,
	`hourlyRate` decimal(10,2),
	`isDefault` boolean DEFAULT false,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`company` varchar(200),
	`street` varchar(200),
	`zipCode` varchar(10),
	`city` varchar(100),
	`country` varchar(50) DEFAULT 'Schweiz',
	`email` varchar(200),
	`phone` varchar(30),
	`salutation` varchar(200),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pain001_exports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`messageId` varchar(100) NOT NULL,
	`totalAmount` decimal(15,2) NOT NULL,
	`paymentCount` int NOT NULL,
	`status` enum('exported','partially_confirmed','confirmed') NOT NULL DEFAULT 'exported',
	`s3Url` text,
	`exportDate` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pain001_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pain001_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exportId` int NOT NULL,
	`endToEndId` varchar(100) NOT NULL,
	`creditorName` varchar(200) NOT NULL,
	`creditorIban` varchar(34),
	`amount` decimal(15,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'CHF',
	`reference` varchar(100),
	`status` enum('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
	`confirmedAt` timestamp,
	`journalEntryId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pain001_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`defaultHourlyRate` decimal(10,2) NOT NULL,
	`revenueAccountId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`street` varchar(200),
	`zipCode` varchar(10),
	`city` varchar(100),
	`country` varchar(50) DEFAULT 'Schweiz',
	`iban` varchar(34),
	`bic` varchar(11),
	`paymentTermDays` int DEFAULT 30,
	`contactPerson` varchar(200),
	`email` varchar(200),
	`phone` varchar(30),
	`notes` text,
	`defaultDebitAccountId` int,
	`matchPattern` varchar(300),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`templateType` enum('invoice','letter','contract','other') NOT NULL DEFAULT 'invoice',
	`description` text,
	`s3Key` varchar(500) NOT NULL,
	`s3Url` text NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`isDefault` boolean DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`serviceId` int NOT NULL,
	`date` date NOT NULL,
	`hours` decimal(6,2) NOT NULL,
	`description` text,
	`hourlyRate` decimal(10,2) NOT NULL,
	`status` enum('open','invoiced') NOT NULL DEFAULT 'open',
	`invoiceEntryId` int,
	`userId` int,
	`fiscalYear` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_entries_id` PRIMARY KEY(`id`)
);
