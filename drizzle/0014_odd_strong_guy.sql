CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`userName` varchar(200),
	`action` enum('create','read','update','delete','export','login','logout') NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` varchar(100),
	`details` text,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qr_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`iban` varchar(34) NOT NULL,
	`referenceType` enum('QRR','SCOR','NON') NOT NULL DEFAULT 'QRR',
	`currency` enum('CHF','EUR') NOT NULL DEFAULT 'CHF',
	`additionalInfo` varchar(140),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `qr_settings_id` PRIMARY KEY(`id`)
);
