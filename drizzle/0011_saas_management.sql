ALTER TABLE `roles` ADD `permissions_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `risk_status` text DEFAULT 'on_track' NOT NULL;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `blocked_reason` text;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_at` text;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `last_activity_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `tasks` SET `last_activity_at` = COALESCE(`updated_at`, `created_at`, datetime('now')) WHERE `last_activity_at` = '';
--> statement-breakpoint
ALTER TABLE `tasks` ADD `estimated_hours` integer;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `actual_hours` integer;
--> statement-breakpoint
CREATE INDEX `tasks_risk_status_idx` ON `tasks` (`risk_status`);
--> statement-breakpoint
CREATE INDEX `tasks_due_date_idx` ON `tasks` (`due_date`);
--> statement-breakpoint
CREATE TABLE `task_comments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `task_id` integer NOT NULL,
  `author_user_id` text,
  `author_name` text DEFAULT 'Гость' NOT NULL,
  `body` text NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_comments_task_id_idx` ON `task_comments` (`task_id`);
--> statement-breakpoint
CREATE INDEX `task_comments_task_created_idx` ON `task_comments` (`task_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `task_activity` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `task_id` integer NOT NULL,
  `actor_user_id` text,
  `actor_name` text DEFAULT 'Система' NOT NULL,
  `action` text NOT NULL,
  `summary` text NOT NULL,
  `metadata_json` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_activity_task_id_idx` ON `task_activity` (`task_id`);
--> statement-breakpoint
CREATE INDEX `task_activity_action_idx` ON `task_activity` (`action`);
--> statement-breakpoint
CREATE INDEX `task_activity_created_at_idx` ON `task_activity` (`created_at`);
--> statement-breakpoint
CREATE TABLE `notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `recipient_user_id` text,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `kind` text DEFAULT 'info' NOT NULL,
  `entity_type` text,
  `entity_id` text,
  `read_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_recipient_idx` ON `notifications` (`recipient_user_id`);
--> statement-breakpoint
CREATE INDEX `notifications_read_at_idx` ON `notifications` (`read_at`);
--> statement-breakpoint
CREATE INDEX `notifications_created_at_idx` ON `notifications` (`created_at`);
--> statement-breakpoint
CREATE TABLE `sla_rules` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `priority` text,
  `due_soon_hours` integer DEFAULT 24 NOT NULL,
  `stale_hours` integer DEFAULT 72 NOT NULL,
  `is_default` integer DEFAULT false NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sla_rules_priority_idx` ON `sla_rules` (`priority`);
--> statement-breakpoint
CREATE INDEX `sla_rules_default_idx` ON `sla_rules` (`is_default`);
--> statement-breakpoint
CREATE TABLE `app_settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value_json` text NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_exports` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `type` text NOT NULL,
  `format` text DEFAULT 'csv' NOT NULL,
  `filters_json` text,
  `created_by_user_id` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `report_exports_type_idx` ON `report_exports` (`type`);
--> statement-breakpoint
CREATE INDEX `report_exports_created_at_idx` ON `report_exports` (`created_at`);
--> statement-breakpoint
INSERT INTO `sla_rules` (`name`, `priority`, `due_soon_hours`, `stale_hours`, `is_default`) VALUES
  ('Стандартный SLA', NULL, 24, 72, 1),
  ('Критические задачи', 'critical', 12, 24, 0),
  ('Высокий приоритет', 'high', 24, 48, 0);
--> statement-breakpoint
INSERT INTO `app_settings` (`key`, `value_json`) VALUES
  ('product', '{"name":"TaskFlow","mode":"b2b-single-tenant","offlineRequired":false}'),
  ('security', '{"sessionHours":1,"passwordMinLength":8,"auditRetentionDays":180}');
