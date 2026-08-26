CREATE TABLE `recurring_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int NOT NULL,
	`subject` varchar(300) NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`currency` enum('CHF','EUR') NOT NULL DEFAULT 'CHF',
	`interval` enum('monthly','quarterly','yearly') NOT NULL,
	`nextRunDate` date NOT NULL,
	`paymentTermDays` int NOT NULL DEFAULT 30,
	`isActive` boolean NOT NULL DEFAULT true,
	`schedule_cron_task_uid` varchar(65),
	`lastInvoiceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_invoices_id` PRIMARY KEY(`id`)
);
