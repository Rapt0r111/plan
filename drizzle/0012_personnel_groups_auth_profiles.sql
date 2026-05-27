CREATE TABLE IF NOT EXISTS `personnel_groups` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `key` text NOT NULL,
  `label` text NOT NULL,
  `description` text,
  `color` text DEFAULT '#8b5cf6' NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `personnel_groups_key_idx` ON `personnel_groups` (`key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `personnel_groups_active_idx` ON `personnel_groups` (`is_active`);
--> statement-breakpoint
INSERT INTO `personnel_groups` (`key`, `label`, `description`, `color`, `sort_order`, `is_active`)
VALUES
  ('permanent', 'Постоянный состав', 'Пользователи постоянного состава.', '#8b5cf6', 0, 1),
  ('variable', 'Переменный состав', 'Пользователи переменного состава.', '#38bdf8', 10, 1)
ON CONFLICT(`key`) DO NOTHING;
--> statement-breakpoint
ALTER TABLE `roles` ADD `personnel_group_id` integer REFERENCES `personnel_groups`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
UPDATE `roles`
SET `personnel_group_id` = (
  SELECT `id` FROM `personnel_groups`
  WHERE `personnel_groups`.`key` = COALESCE(`roles`.`composition`, 'permanent')
)
WHERE `personnel_group_id` IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `roles_personnel_group_idx` ON `roles` (`personnel_group_id`);
--> statement-breakpoint
ALTER TABLE `users` ADD `auth_user_id` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `account_status` text DEFAULT 'invited' NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `legacy_login_alias` text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_auth_user_id_idx` ON `users` (`auth_user_id`);
--> statement-breakpoint
ALTER TABLE `user` ADD `profile_id` integer REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_profile_id_idx` ON `user` (`profile_id`);
--> statement-breakpoint
UPDATE `users`
SET
  `auth_user_id` = (
    SELECT `id` FROM `user`
    WHERE lower(`user`.`login`) = lower(`users`.`login`)
    LIMIT 1
  ),
  `account_status` = CASE
    WHEN EXISTS (
      SELECT 1 FROM `user`
      WHERE lower(`user`.`login`) = lower(`users`.`login`)
    ) THEN 'active'
    ELSE `account_status`
  END
WHERE `auth_user_id` IS NULL;
--> statement-breakpoint
UPDATE `user`
SET `profile_id` = (
  SELECT `id` FROM `users`
  WHERE lower(`users`.`login`) = lower(`user`.`login`)
  LIMIT 1
)
WHERE `profile_id` IS NULL;
--> statement-breakpoint
UPDATE `users`
SET
  `auth_user_id` = (SELECT `id` FROM `user` WHERE lower(`user`.`login`) = 'tse' LIMIT 1),
  `account_status` = 'active',
  `legacy_login_alias` = CASE
    WHEN `legacy_login_alias` IS NULL AND lower(`login`) <> 'tse' THEN `login`
    ELSE `legacy_login_alias`
  END,
  `login` = 'tse'
WHERE lower(`login`) = 'tarasenko'
  AND EXISTS (SELECT 1 FROM `user` WHERE lower(`user`.`login`) = 'tse');
--> statement-breakpoint
UPDATE `user`
SET `profile_id` = (SELECT `id` FROM `users` WHERE lower(`users`.`login`) = 'tse' LIMIT 1)
WHERE lower(`login`) = 'tse';
