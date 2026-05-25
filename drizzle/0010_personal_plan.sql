CREATE TABLE `personal_plan_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `weekday` integer NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `start_time` text NOT NULL,
  `end_time` text NOT NULL,
  `color` text DEFAULT '#8b5cf6' NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `personal_plan_items_user_id_idx` ON `personal_plan_items` (`user_id`);
--> statement-breakpoint
CREATE INDEX `personal_plan_items_weekday_idx` ON `personal_plan_items` (`weekday`);
--> statement-breakpoint
CREATE INDEX `personal_plan_items_user_weekday_idx` ON `personal_plan_items` (`user_id`, `weekday`);
--> statement-breakpoint
CREATE TABLE `personal_plan_completions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `item_id` integer NOT NULL,
  `date` text NOT NULL,
  `completed_by_user_id` text,
  `completed_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`item_id`) REFERENCES `personal_plan_items`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`completed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_personal_plan_item_date` ON `personal_plan_completions` (`item_id`, `date`);
--> statement-breakpoint
CREATE INDEX `personal_plan_completions_item_id_idx` ON `personal_plan_completions` (`item_id`);
--> statement-breakpoint
CREATE INDEX `personal_plan_completions_date_idx` ON `personal_plan_completions` (`date`);
