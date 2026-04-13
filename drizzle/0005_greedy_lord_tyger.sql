ALTER TABLE `bank_transactions` ADD `transferPartnerId` int;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `isTransfer` boolean DEFAULT false;