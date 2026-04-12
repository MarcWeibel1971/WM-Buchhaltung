CREATE TABLE `booking_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`counterpartyPattern` varchar(300) NOT NULL,
	`descriptionPattern` varchar(500),
	`bookingTextTemplate` varchar(500),
	`debitAccountId` int,
	`creditAccountId` int,
	`vatRate` decimal(5,2),
	`usageCount` int NOT NULL DEFAULT 0,
	`priority` int NOT NULL DEFAULT 10,
	`source` enum('manual','ai') NOT NULL DEFAULT 'manual',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `booking_rules_id` PRIMARY KEY(`id`)
);
