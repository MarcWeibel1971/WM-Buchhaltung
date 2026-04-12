CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`s3Key` varchar(500) NOT NULL,
	`s3Url` text NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`documentType` enum('invoice_in','invoice_out','receipt','bank_statement','other') NOT NULL DEFAULT 'other',
	`journalEntryId` int,
	`bankTransactionId` int,
	`extractedText` text,
	`aiMetadata` text,
	`notes` text,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
