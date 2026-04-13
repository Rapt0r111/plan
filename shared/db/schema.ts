/**
 * @file schema.ts — shared/db
 *
 * v4 — Оперативные задачи с дедлайном:
 *   - Добавлен `due_date` в operative_tasks
 *   - Миграция: 0004_operative_due_date.sql
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

export const authUsers = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const accounts = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verifications = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// ─── TABLE: operative_tasks ──────────────────────────────────────────────────
// Оперативные задачи, привязанные к конкретным пользователям.
// Удаление запрещено — только добавление и смена статуса.
export const OPERATIVE_STATUSES = ["todo", "in_progress", "done"] as const;
export type OperativeTaskStatus = (typeof OPERATIVE_STATUSES)[number];

export const operativeTasks = sqliteTable(
  "operative_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").$type<OperativeTaskStatus>().notNull().default("todo"),
    dueDate: text("due_date"),                          // ← НОВОЕ: v4
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
    order: integer("order").notNull().default(0), // ← НОВОЕ
  },
  (t) => ({
    userIdIdx: index("op_tasks_user_id_idx").on(t.userId),
    statusIdx: index("op_tasks_status_idx").on(t.status),
  })
);

// ─── TABLE: operative_subtasks ───────────────────────────────────────────────
export const operativeSubtasks = sqliteTable(
  "operative_subtasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").notNull().references(() => operativeTasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    taskIdIdx: index("op_subtasks_task_id_idx").on(t.taskId),
  })
);

// ─── TABLE: audit_log ────────────────────────────────────────────────────────
// Tracks all mutations: who did what, when, on which entity.
// Retained indefinitely — never delete audit records.
export const auditLog = sqliteTable(
  "audit_log",
  {
    id:          integer("id").primaryKey({ autoIncrement: true }),
    actorEmail:  text("actor_email").notNull(),
    actorRole:   text("actor_role").notNull().default("member"),
    action:      text("action").notNull(),       // CREATE | UPDATE | DELETE | STATUS_CHANGE | REORDER
    entityType:  text("entity_type").notNull(),  // task | epic | operative_task | user | role | subtask
    entityId:    integer("entity_id"),
    entityTitle: text("entity_title"),           // human-readable snapshot
    details:     text("details"),                // JSON: { before?, after?, patch? }
    ipAddress:   text("ip_address"),
    userAgent:   text("user_agent"),
    createdAt:   text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    actorIdx:    index("audit_actor_idx").on(t.actorEmail),
    entityIdx:   index("audit_entity_idx").on(t.entityType, t.entityId),
    createdIdx:  index("audit_created_at_idx").on(t.createdAt),
  })
);

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "REORDER"
  | "LOGIN"
  | "SUBTASK_TOGGLE";

export type AuditEntityType =
  | "task"
  | "epic"
  | "operative_task"
  | "operative_subtask"
  | "user"
  | "role"
  | "subtask";