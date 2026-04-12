ALTER TABLE `bank_transactions` ADD `matchedDocumentId` int;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `matchScore` int;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `suggestedBookingText` varchar(500);--> statement-breakpoint
ALTER TABLE `documents` ADD `matchStatus` enum('unmatched','matched','manual') DEFAULT 'unmatched' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `matchScore` int;