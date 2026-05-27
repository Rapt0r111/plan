/**
 * @file schema.ts — shared/db
 *
 * v5 — Персистентный порядок блоков пользователей:
 *   - Добавлен `block_order` в таблицу `users`
 *   - Позволяет сохранять порядок блоков на странице оперативных задач
 *     между сессиями и делиться им между всеми участниками
 *   - Миграция: 0007_user_block_order.sql
 */
import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const PERSONNEL_COMPOSITION_KEYS = ["permanent", "variable"] as const;
export type PersonnelComposition = (typeof PERSONNEL_COMPOSITION_KEYS)[number];

export const USER_ACCOUNT_STATUSES = ["active", "invited", "disabled"] as const;
export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export const personnelGroups = sqliteTable(
  "personnel_groups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#8b5cf6"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    keyIdx: uniqueIndex("personnel_groups_key_idx").on(t.key),
    activeIdx: index("personnel_groups_active_idx").on(t.isActive),
  })
);

// ─── TABLE: roles ─────────────────────────────────────────────────────────────
export const roles = sqliteTable(
  "roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    short: text("short").notNull(),
    hex: text("hex").notNull(),
    description: text("description"),
    composition: text("composition").$type<PersonnelComposition>().notNull().default("permanent"),
    personnelGroupId: integer("personnel_group_id").references(() => personnelGroups.id, { onDelete: "set null" }),
    permissionsJson: text("permissions_json").notNull().default("[]"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    compositionIdx: index("roles_composition_idx").on(t.composition),
  })
);

// ─── TABLE: users ─────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  login: text("login").notNull().unique(),
  roleId: integer("role_id").notNull().references(() => roles.id),
  initials: text("initials").notNull(),
  authUserId: text("auth_user_id"),
  accountStatus: text("account_status").$type<UserAccountStatus>().notNull().default("invited"),
  legacyLoginAlias: text("legacy_login_alias"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  /**
   * blockOrder — порядок блока пользователя на странице оперативных задач.
   * Обновляется через PATCH /api/operative-blocks при перетаскивании.
   * Общий для всех участников (хранится в БД).
   * Инициализируется значением id при создании (см. миграцию 0007).
   */
  blockOrder: integer("block_order").notNull().default(0),
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

export const TASK_RISK_STATUSES = [
  "on_track",
  "at_risk",
  "due_today",
  "overdue",
  "blocked",
  "stale",
  "unassigned",
  "completed",
] as const;
export type TaskRiskStatus = (typeof TASK_RISK_STATUSES)[number];

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    epicId: integer("epic_id").notNull().references(() => epics.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    priority: text("priority").$type<TaskPriority>().notNull().default("medium"),
    riskStatus: text("risk_status").$type<TaskRiskStatus>().notNull().default("on_track"),
    blockedReason: text("blocked_reason"),
    dueDate: text("due_date"),
    completedAt: text("completed_at"),
    lastActivityAt: text("last_activity_at").notNull().default(""),
    estimatedHours: integer("estimated_hours"),
    actualHours: integer("actual_hours"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    epicIdIdx: index("tasks_epic_id_idx").on(t.epicId),
    statusIdx: index("tasks_status_idx").on(t.status),
    priorityIdx: index("tasks_priority_idx").on(t.priority),
    riskStatusIdx: index("tasks_risk_status_idx").on(t.riskStatus),
    dueDateIdx: index("tasks_due_date_idx").on(t.dueDate),
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
  login: text("login").unique(),
  profileId: integer("profile_id").references(() => users.id, { onDelete: "set null" }),
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
    dueDate: text("due_date"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
    /**
     * order — поле для DnD-сортировки внутри блока пользователя.
     * Обновляется через updateOrderAction при перетаскивании задач.
     * Используется в sortTasks() как финальный ключ сортировки.
     */
    order: integer("order").notNull().default(0),
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

export const operativeTaskComments = sqliteTable(
  "operative_task_comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").notNull().references(() => operativeTasks.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id"),
    authorName: text("author_name").notNull().default("Гость"),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    taskIdIdx: index("op_task_comments_task_id_idx").on(t.taskId),
    taskCreatedAtIdx: index("op_task_comments_task_created_idx").on(t.taskId, t.createdAt),
  })
);

export const taskComments = sqliteTable(
  "task_comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id"),
    authorName: text("author_name").notNull().default("Гость"),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    taskIdIdx: index("task_comments_task_id_idx").on(t.taskId),
    taskCreatedAtIdx: index("task_comments_task_created_idx").on(t.taskId, t.createdAt),
  })
);

export const taskActivity = sqliteTable(
  "task_activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id"),
    actorName: text("actor_name").notNull().default("Система"),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    taskIdIdx: index("task_activity_task_id_idx").on(t.taskId),
    actionIdx: index("task_activity_action_idx").on(t.action),
    createdAtIdx: index("task_activity_created_at_idx").on(t.createdAt),
  })
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipientUserId: text("recipient_user_id"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    kind: text("kind").notNull().default("info"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    recipientIdx: index("notifications_recipient_idx").on(t.recipientUserId),
    readAtIdx: index("notifications_read_at_idx").on(t.readAt),
    createdAtIdx: index("notifications_created_at_idx").on(t.createdAt),
  })
);

export const slaRules = sqliteTable(
  "sla_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    priority: text("priority").$type<TaskPriority>(),
    dueSoonHours: integer("due_soon_hours").notNull().default(24),
    staleHours: integer("stale_hours").notNull().default(72),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    priorityIdx: index("sla_rules_priority_idx").on(t.priority),
    defaultIdx: index("sla_rules_default_idx").on(t.isDefault),
  })
);

export const appSettings = sqliteTable(
  "app_settings",
  {
    key: text("key").primaryKey(),
    valueJson: text("value_json").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  }
);

export const reportExports = sqliteTable(
  "report_exports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    format: text("format").notNull().default("csv"),
    filtersJson: text("filters_json"),
    createdByUserId: text("created_by_user_id"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    typeIdx: index("report_exports_type_idx").on(t.type),
    createdAtIdx: index("report_exports_created_at_idx").on(t.createdAt),
  })
);

// ─── TABLE: personal_plan_items ──────────────────────────────────────────────
export const personalPlanItems = sqliteTable(
  "personal_plan_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    color: text("color").notNull().default("#8b5cf6"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    userIdIdx: index("personal_plan_items_user_id_idx").on(t.userId),
    weekdayIdx: index("personal_plan_items_weekday_idx").on(t.weekday),
    userWeekdayIdx: index("personal_plan_items_user_weekday_idx").on(t.userId, t.weekday),
  })
);

// ─── TABLE: personal_plan_completions ────────────────────────────────────────
export const personalPlanCompletions = sqliteTable(
  "personal_plan_completions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: integer("item_id").notNull().references(() => personalPlanItems.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    completedByUserId: text("completed_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    completedAt: text("completed_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    uniqItemDate: uniqueIndex("uq_personal_plan_item_date").on(t.itemId, t.date),
    itemIdIdx: index("personal_plan_completions_item_id_idx").on(t.itemId),
    dateIdx: index("personal_plan_completions_date_idx").on(t.date),
  })
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: text("actor_user_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    actionIdx: index("audit_logs_action_idx").on(t.action),
    entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
  })
);
