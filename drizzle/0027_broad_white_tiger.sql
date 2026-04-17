ALTER TABLE `booking_rules` ADD `scope` enum('global','org') DEFAULT 'org' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_rules` ADD `globalDebitAccountNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `booking_rules` ADD `globalCreditAccountNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `booking_rules` ADD `categoryHint` varchar(200);