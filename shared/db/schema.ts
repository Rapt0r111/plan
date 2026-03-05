/**
 * @file schema.ts — shared/db
 *
 * ИСПРАВЛЕНИЕ: добавлена роль "security_officer" в ROLES array.
 *
 * ПРОБЛЕМА: shared/config/roles.ts определял security_officer в типе Role
 * и в ROLE_META, но в schema.ts этой роли не было. Это приводило к:
 *   1. Несовместимости типов Role между schema.ts и roles.ts
 *   2. Потенциальному падению ROLE_META[row.role] при обращении
 *      к пользователю с этой ролью (undefined → TypeError)
 *   3. Несоответствию типов при Drizzle-инференсе
 */

import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ─── DOMAIN CONSTANTS ────────────────────────────────────────────────────────

export const ROLES = [
  "company_commander",   // КНР
  "platoon_1_commander", // КВ1
  "platoon_2_commander", // КВ2
  "deputy_platoon_1",    // ЗКВ1
  "deputy_platoon_2",    // ЗКВ2
  "squad_commander_2",   // КО2
  "sergeant_major",      // СР
  "security_officer",    // ЗГТ  ← ДОБАВЛЕНО (было в ROLE_META, не было в schema)
  "duty_officer",        // ПС
] as const;

export type Role = (typeof ROLES)[number];
export const TASK_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// ─── TABLE: users ─────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id:       integer("id").primaryKey({ autoIncrement: true }),
  name:     text("name").notNull(),
  login:    text("login").notNull().unique(),
  role:     text("role").$type<Role>().notNull(),
  initials: text("initials").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── TABLE: epics ─────────────────────────────────────────────────────────────
export const epics = sqliteTable("epics", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  title:       text("title").notNull(),
  description: text("description"),
  color:       text("color").notNull().default("#6366f1"),
  startDate:   text("start_date"),
  endDate:     text("end_date"),
  createdAt:   text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt:   text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── TABLE: tasks ─────────────────────────────────────────────────────────────
export const tasks = sqliteTable("tasks", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  epicId:      integer("epic_id").notNull().references(() => epics.id, { onDelete: "cascade" }),
  title:       text("title").notNull(),
  description: text("description"),
  status:      text("status").$type<TaskStatus>().notNull().default("todo"),
  priority:    text("priority").$type<TaskPriority>().notNull().default("medium"),
  dueDate:     text("due_date"),
  sortOrder:   integer("sort_order").notNull().default(0),
  createdAt:   text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt:   text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── TABLE: subtasks ──────────────────────────────────────────────────────────
export const subtasks = sqliteTable("subtasks", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  taskId:      integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title:       text("title").notNull(),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  sortOrder:   integer("sort_order").notNull().default(0),
  createdAt:   text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── TABLE: task_assignees ───────────────────────────────────────────────────
export const taskAssignees = sqliteTable(
  "task_assignees",
  {
    id:         integer("id").primaryKey({ autoIncrement: true }),
    taskId:     integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    userId:     integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    assignedAt: text("assigned_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    uniqAssignment: uniqueIndex("uq_task_user").on(t.taskId, t.userId),
  })
);