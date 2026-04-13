ALTER TABLE `user` ADD `login` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `user_login_unique` ON `user` (`login`);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `actor_user_id` text,
  `actor_role` text,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text,
  `before_json` text,
  `after_json` text,
  `metadata_json` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);
--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);
