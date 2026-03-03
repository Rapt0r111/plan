# Task Manager — Этап 1: Data Layer

## Быстрый старт (требуется Bun)

bun install
bun run db:generate
bun run db:migrate
bun run db:seed
bun run dev

Полный сброс: bun run db:reset

## FSD структура

src/
  shared/db/         -- schema.ts, client.ts, migrate.ts, seed.ts
  shared/types/      -- index.ts (Drizzle-инферы + enriched типы)
  shared/config/     -- roles.ts (8 ролей, цвета)
  shared/lib/        -- utils.ts
  entities/          -- user/, epic/, task/
  features/          -- task-board/, task-form/, epic-filter/, role-badge/
  widgets/           -- sidebar/, header/, task-list/
  pages/             -- dashboard/, epic-detail/
  app/               -- layout, providers, api routes

## ERD

users (id, name, login, role, initials)
epics (id, title, description, color, start_date, end_date)
tasks (id, epic_id FK, title, status, priority, due_date, sort_order)
subtasks (id, task_id FK, title, is_completed, sort_order)
task_assignees (id, task_id FK, user_id FK) -- M:N junction, UNIQUE(task_id, user_id)

## Seed: 5 эпиков, 26 задач, 55+ подзадач

Итоговая проверка | Квартальные проверки | Приём пополнения | Агитация | Наука и МВТФ Армия
