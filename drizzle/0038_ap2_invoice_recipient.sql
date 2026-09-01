ALTER TABLE `invoices` ADD `recipientName` varchar(200);--> statement-breakpoint
ALTER TABLE `invoices` ADD `recipientStreet` varchar(200);--> statement-breakpoint
ALTER TABLE `invoices` ADD `recipientZip` varchar(10);--> statement-breakpoint
ALTER TABLE `invoices` ADD `recipientCity` varchar(100);