ALTER TABLE `user` ADD `force_password_change` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;
--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;
--> statement-breakpoint
ALTER TABLE `session` ADD `impersonatedBy` text;
