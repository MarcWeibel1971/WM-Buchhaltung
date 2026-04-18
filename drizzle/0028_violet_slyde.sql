CREATE TABLE `avatar_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`language` varchar(10) NOT NULL DEFAULT 'de-CH',
	`style` enum('concise','balanced','detailed') NOT NULL DEFAULT 'concise',
	`maxSentences` int NOT NULL DEFAULT 2,
	`customPrompt` text,
	`voiceId` varchar(100),
	`avatarName` varchar(100) NOT NULL DEFAULT 'Berater',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `avatar_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `avatar_settings_organizationId_unique` UNIQUE(`organizationId`)
);
