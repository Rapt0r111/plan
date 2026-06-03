CREATE TABLE `variable_daily_tasks` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `author_user_id` text,
  `profile_user_id` integer NOT NULL,
  `task_date` text NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `status` text DEFAULT 'todo' NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`profile_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `variable_daily_tasks_profile_date_idx` ON `variable_daily_tasks` (`profile_user_id`,`task_date`);
--> statement-breakpoint
CREATE INDEX `variable_daily_tasks_date_idx` ON `variable_daily_tasks` (`task_date`);
--> statement-breakpoint
CREATE INDEX `variable_daily_tasks_status_idx` ON `variable_daily_tasks` (`status`);
--> statement-breakpoint
CREATE TABLE `variable_leave_requests` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `requester_user_id` text,
  `profile_user_id` integer NOT NULL,
  `leave_type` text NOT NULL,
  `date_from` text NOT NULL,
  `date_to` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `comment` text,
  `reviewed_by_user_id` text,
  `reviewed_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`requester_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`profile_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `variable_leave_requests_profile_date_idx` ON `variable_leave_requests` (`profile_user_id`,`date_from`);
--> statement-breakpoint
CREATE INDEX `variable_leave_requests_status_idx` ON `variable_leave_requests` (`status`);
--> statement-breakpoint
CREATE INDEX `variable_leave_requests_date_idx` ON `variable_leave_requests` (`date_from`,`date_to`);
--> statement-breakpoint
CREATE TABLE `variable_duty_assignments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `duty_date` text NOT NULL,
  `slot` text NOT NULL,
  `user_id` integer NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_variable_duty_date_slot` ON `variable_duty_assignments` (`duty_date`,`slot`);
--> statement-breakpoint
CREATE INDEX `variable_duty_assignments_date_idx` ON `variable_duty_assignments` (`duty_date`);
--> statement-breakpoint
CREATE INDEX `variable_duty_assignments_user_date_idx` ON `variable_duty_assignments` (`user_id`,`duty_date`);
