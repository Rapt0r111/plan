/**
 * @file schema.ts — shared/db
 *
 * Single source of truth for the entire database schema.
 * Drizzle ORM + better-sqlite3 — zero-overhead local SQLite, no server process.
 *
 * Design decisions:
 *  - Integer PKs → fastest SQLite joins, skip UUID overhead on intranet scale
 *  - text.$type<Union>() → no separate enum tables needed in SQLite
 *  - Explicit ISO timestamps → lightweight audit trail
 *  - task_assignees junction table → clean M:N without JSON columns
 */

import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ─── DOMAIN CONSTANTS ────────────────────────────────────────────────────────
// Co-located with schema to keep the single source of truth in one file.

/** 8 organisational roles — stored as slugs for DB readability & portability */
export const ROLES = [
  "company_commander",
  "deputy_commander",
  "platoon_1_commander",
  "platoon_2_commander",
  "deputy_platoon_1",    // ЗКВ1 (Антипов)
  "deputy_platoon_2",    // ЗКВ2 (Ермаков)
  "squad_commander_2",   // КО2 (Арсенов)
  "sergeant_major",
  "security_officer",
  "research_officer",
  "duty_officer",
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
// High-level groupings (e.g. "Q1 Audit", "New Intake").
// Inspired by Linear's project concept — temporal + thematic context.
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
// Core work item. Belongs to one Epic, has many subtasks and assignees.
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
// Checklist items under a task. Separate table (vs JSON column) for queryability.
export const subtasks = sqliteTable("subtasks", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  taskId:      integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title:       text("title").notNull(),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  sortOrder:   integer("sort_order").notNull().default(0),
  createdAt:   text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── TABLE: task_assignees ───────────────────────────────────────────────────
// Many-to-Many junction: one task → multiple users, one user → multiple tasks.
// Unique index makes INSERT OR IGNORE safe for idempotent assignment.
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
