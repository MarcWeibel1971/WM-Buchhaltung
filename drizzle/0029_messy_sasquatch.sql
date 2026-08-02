CREATE TABLE `import_automation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`autoKiCategorize` boolean NOT NULL DEFAULT true,
	`autoGenerateBookingTexts` boolean NOT NULL DEFAULT true,
	`autoRefreshLearned` boolean NOT NULL DEFAULT true,
	`autoDetectTransfers` boolean NOT NULL DEFAULT true,
	`autoMatchDocuments` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_automation_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `import_automation_settings_organizationId_unique` UNIQUE(`organizationId`)
);
