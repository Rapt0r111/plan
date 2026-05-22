ALTER TABLE `roles` ADD `composition` text DEFAULT 'permanent' NOT NULL;
--> statement-breakpoint
CREATE INDEX `roles_composition_idx` ON `roles` (`composition`);
--> statement-breakpoint
INSERT INTO `roles` (`key`, `label`, `short`, `hex`, `description`, `composition`, `sort_order`)
SELECT
  'variable_member',
  'Переменный состав',
  'ПРС',
  '#34d399',
  'Базовая роль для участников переменного состава.',
  'variable',
  50
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `key` = 'variable_member');
