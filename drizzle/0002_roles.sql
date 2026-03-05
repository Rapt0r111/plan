-- Создаём таблицу roles
CREATE TABLE IF NOT EXISTS `roles` (
  `id`          INTEGER PRIMARY KEY AUTOINCREMENT,
  `key`         TEXT NOT NULL UNIQUE,
  `label`       TEXT NOT NULL,
  `short`       TEXT NOT NULL,
  `hex`         TEXT NOT NULL,
  `description` TEXT,
  `sort_order`  INTEGER NOT NULL DEFAULT 0,
  `created_at`  TEXT NOT NULL DEFAULT (datetime('now')),
  `updated_at`  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Заполняем существующими ролями ДО изменения users
INSERT INTO `roles` (`key`, `label`, `short`, `hex`, `sort_order`) VALUES
  ('company_commander',   'Командир роты',          'КНР',  '#8b5cf6', 0),
  ('platoon_1_commander', 'Командир 1 взвода',      'КВ-1', '#38bdf8', 1),
  ('platoon_2_commander', 'Командир 2 взвода',      'КВ-2', '#60a5fa', 2),
  ('deputy_platoon_1',    'Зам. ком. 1 взвода',     'ЗКВ1', '#22d3ee', 3),
  ('deputy_platoon_2',    'Зам. ком. 2 взвода',     'ЗКВ2', '#2dd4bf', 4),
  ('sergeant_major',      'Старшина роты',          'СР',   '#fbbf24', 5),
  ('squad_commander_2',   'Командир 2 отделения',   'КО-2', '#fb923c', 6),
  ('security_officer',    'Ответственный за ЗГТ',   'ЗГТ',  '#f87171', 7),
  ('duty_officer',        'Постоянный состав',      'ПС',   '#94a3b8', 8);

-- Добавляем role_id к users через временный столбец
ALTER TABLE `users` ADD COLUMN `role_id` INTEGER REFERENCES `roles`(`id`);

-- Заполняем role_id на основе текущего role text
UPDATE `users` SET `role_id` = (
  SELECT `id` FROM `roles` WHERE `roles`.`key` = `users`.`role`
);

-- Устанавливаем fallback для возможных NULL (duty_officer)
UPDATE `users` SET `role_id` = (
  SELECT `id` FROM `roles` WHERE `key` = 'duty_officer'
) WHERE `role_id` IS NULL;

-- Пересоздаём таблицу без поля role (SQLite не поддерживает DROP COLUMN в старых версиях)
CREATE TABLE `users_new` (
  `id`         INTEGER PRIMARY KEY AUTOINCREMENT,
  `name`       TEXT NOT NULL,
  `login`      TEXT NOT NULL UNIQUE,
  `role_id`    INTEGER NOT NULL REFERENCES `roles`(`id`),
  `initials`   TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO `users_new` (`id`, `name`, `login`, `role_id`, `initials`, `created_at`)
SELECT `id`, `name`, `login`, `role_id`, `initials`, `created_at` FROM `users`;

DROP TABLE `users`;
ALTER TABLE `users_new` RENAME TO `users`;