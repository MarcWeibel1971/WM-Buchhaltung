CREATE TABLE `invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`position` int NOT NULL,
	`serviceId` int,
	`description` text NOT NULL,
	`quantity` decimal(10,2) NOT NULL DEFAULT '1',
	`unit` varchar(20) DEFAULT 'Stk',
	`unitPrice` decimal(15,2) NOT NULL,
	`vatRate` decimal(5,2) NOT NULL DEFAULT '0',
	`revenueAccountId` int,
	`lineSubtotal` decimal(15,2) NOT NULL,
	`lineVat` decimal(15,2) NOT NULL,
	`lineTotal` decimal(15,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_sequences` (
	`organizationId` int NOT NULL,
	`fiscalYear` int NOT NULL,
	`nextSequence` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoice_sequences_organizationId_fiscalYear_pk` PRIMARY KEY(`organizationId`,`fiscalYear`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`invoiceNumber` varchar(30),
	`customerId` int NOT NULL,
	`invoiceDate` date NOT NULL,
	`dueDate` date NOT NULL,
	`paidDate` date,
	`paymentTermDays` int NOT NULL DEFAULT 30,
	`status` enum('draft','sent','partially_paid','paid','cancelled','written_off') NOT NULL DEFAULT 'draft',
	`subject` varchar(300),
	`introText` text,
	`footerText` text,
	`subtotal` decimal(15,2) NOT NULL DEFAULT '0',
	`vatTotal` decimal(15,2) NOT NULL DEFAULT '0',
	`total` decimal(15,2) NOT NULL DEFAULT '0',
	`paidAmount` decimal(15,2) NOT NULL DEFAULT '0',
	`currency` enum('CHF','EUR') NOT NULL DEFAULT 'CHF',
	`qrReference` varchar(50),
	`journalEntryId` int,
	`cancelJournalEntryId` int,
	`sentAt` timestamp,
	`cancelledAt` timestamp,
	`fiscalYear` int,
	`pdfS3Key` varchar(500),
	`pdfS3Url` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_org_invoiceNumber_unique` UNIQUE(`organizationId`,`invoiceNumber`)
);
