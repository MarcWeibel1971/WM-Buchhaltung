ALTER TABLE `journal_entries` ADD `createdBy` int;--> statement-breakpoint
ALTER TABLE `organizations` ADD `requiresDualApproval` boolean DEFAULT false NOT NULL;