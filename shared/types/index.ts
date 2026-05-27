// shared/types/index.ts — полная версия

import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  personnelGroups,
  roles,
  epics,
  tasks,
  subtasks,
  taskAssignees,
  taskComments,
  taskActivity,
  notifications,
  slaRules,
  appSettings,
  reportExports,
  TaskStatus,
  TaskPriority,
  TaskRiskStatus,
  UserAccountStatus,
} from "@/shared/db/schema";

export type { TaskStatus, TaskPriority, TaskRiskStatus, UserAccountStatus };

// ─── BASE INFERRED TYPES ──────────────────────────────────────────────────────
export type DbUser = InferSelectModel<typeof users>;
export type DbPersonnelGroup = InferSelectModel<typeof personnelGroups>;
export type DbRoleBase = InferSelectModel<typeof roles>;
export type DbRole = DbRoleBase & {
  personnelGroup?: DbPersonnelGroup | null;
};
export type DbEpic = InferSelectModel<typeof epics>;
export type DbTask = InferSelectModel<typeof tasks>;
export type DbSubtask = InferSelectModel<typeof subtasks>;
export type DbTaskAssignee = InferSelectModel<typeof taskAssignees>;
export type DbTaskComment = InferSelectModel<typeof taskComments>;
export type DbTaskActivity = InferSelectModel<typeof taskActivity>;
export type DbNotification = InferSelectModel<typeof notifications>;
export type DbSlaRule = InferSelectModel<typeof slaRules>;
export type DbAppSetting = InferSelectModel<typeof appSettings>;
export type DbReportExport = InferSelectModel<typeof reportExports>;

export type NewUser = InferInsertModel<typeof users>;
export type NewRole = InferInsertModel<typeof roles>;
export type NewEpic = InferInsertModel<typeof epics>;
export type NewTask = InferInsertModel<typeof tasks>;
export type NewTaskComment = InferInsertModel<typeof taskComments>;
export type NewTaskActivity = InferInsertModel<typeof taskActivity>;
export type NewNotification = InferInsertModel<typeof notifications>;

// ─── ROLE METADATA ────────────────────────────────────────────────────────────
export type RoleMeta = DbRole;

// ─── ENRICHED APPLICATION TYPES ──────────────────────────────────────────────
export interface UserWithMeta extends DbUser {
  roleMeta: RoleMeta;
}

export type SubtaskView = DbSubtask;

export interface TaskView extends DbTask {
  assignees: UserWithMeta[];
  subtasks: SubtaskView[];
  comments?: DbTaskComment[];
  activity?: DbTaskActivity[];
  progress: { done: number; total: number };
}

export interface EpicWithTasks extends DbEpic {
  tasks: TaskView[];
  progress: { done: number; total: number };
}

// ─── EpicSummary — лёгкая версия для списков и сайдбара ──────────────────────
export type EpicSummary = DbEpic & {
  taskCount: number;
  doneCount: number;
};


export type CreateTaskInput = {
  epicId: number;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  description?: string | null;
  dueDate?: string | null;
};
// ─── API RESPONSE SHAPES ──────────────────────────────────────────────────────
export interface ApiSuccess<T> { ok: true; data: T }
export interface ApiError { ok: false; error: string; code?: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
