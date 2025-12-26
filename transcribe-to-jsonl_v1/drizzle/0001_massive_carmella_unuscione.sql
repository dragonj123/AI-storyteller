CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobType` enum('audio','document','slide') NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`originalFileName` text NOT NULL,
	`originalFileUrl` text NOT NULL,
	`originalFileKey` text NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`jsonlUrl` text,
	`jsonlFileKey` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
