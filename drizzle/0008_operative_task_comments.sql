CREATE TABLE `operative_task_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`author_user_id` text,
	`author_name` text DEFAULT 'Гость' NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `operative_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `op_task_comments_task_id_idx` ON `operative_task_comments` (`task_id`);
--> statement-breakpoint
CREATE INDEX `op_task_comments_task_created_idx` ON `operative_task_comments` (`task_id`,`created_at`);
