/**
 * @file schema.ts — shared/db
 *
 * BREAKING CHANGE v2:
 *   - Добавлена таблица roles (canonical source of truth)
 *   - users.role: text → users.roleId: integer FK → roles.id
 *   - Удалён ROLES array и Role enum
 *
 * Migration: см. drizzle/XXXX_roles.sql
 */
import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

// ─── TABLE: roles ─────────────────────────────────────────────────────────────
export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  short: text("short").notNull(),
  hex: text("hex").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── TABLE: users ─────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  login: text("login").notNull().unique(),
  roleId: integer("role_id").notNull().references(() => roles.id),
  initials: text("initials").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── TABLE: epics ─────────────────────────────────────────────────────────────
export const epics = sqliteTable("epics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6366f1"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── TABLE: tasks ─────────────────────────────────────────────────────────────
export const TASK_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    epicId: integer("epic_id").notNull().references(() => epics.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    priority: text("priority").$type<TaskPriority>().notNull().default("medium"),
    dueDate: text("due_date"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    epicIdIdx: index("tasks_epic_id_idx").on(t.epicId),
    statusIdx: index("tasks_status_idx").on(t.status),
    priorityIdx: index("tasks_priority_idx").on(t.priority),
    epicStatusIdx: index("tasks_epic_status_idx").on(t.epicId, t.status),
  })
);

// ─── TABLE: subtasks ──────────────────────────────────────────────────────────
export const subtasks = sqliteTable(
  "subtasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    taskIdIdx: index("subtasks_task_id_idx").on(t.taskId),
  })
);

// ─── TABLE: task_assignees ───────────────────────────────────────────────────
export const taskAssignees = sqliteTable(
  "task_assignees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    assignedAt: text("assigned_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    uniqAssignment: uniqueIndex("uq_task_user").on(t.taskId, t.userId),
    taskIdIdx: index("ta_task_id_idx").on(t.taskId),
    userIdIdx: index("ta_user_id_idx").on(t.userId),
  })
);