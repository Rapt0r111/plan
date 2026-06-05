ALTER TABLE `variable_daily_tasks` ADD COLUMN `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `variable_daily_tasks` ADD COLUMN `deleted_by_user_id` text REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `variable_daily_tasks_deleted_at_idx` ON `variable_daily_tasks` (`deleted_at`);
