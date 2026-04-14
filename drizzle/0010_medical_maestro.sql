CREATE TABLE `import_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankAccountId` int NOT NULL,
	`filename` varchar(500) NOT NULL,
	`fileType` varchar(50) NOT NULL,
	`s3Key` varchar(500),
	`s3Url` varchar(1000),
	`importBatchId` varchar(100),
	`transactionsTotal` int NOT NULL DEFAULT 0,
	`transactionsImported` int NOT NULL DEFAULT 0,
	`transactionsDuplicate` int NOT NULL DEFAULT 0,
	`transactionsSkipped` int NOT NULL DEFAULT 0,
	`dateRangeFrom` date,
	`dateRangeTo` date,
	`importedBy` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_history_id` PRIMARY KEY(`id`)
);
