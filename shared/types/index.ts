/**
 * @file index.ts — shared/types
 *
 * ИЗМЕНЕНИЯ v2:
 *   - RoleMeta теперь = DbRole (Drizzle infer). Нет bgClass/textClass/borderClass.
 *   - Tailwind-классы вычисляются на лету через hexToRoleStyles() из inline styles.
 *   - Role type удалён (не нужен без enum)
 *   - DbUser.roleId: integer (было role: text)
 */
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  roles,
  epics,
  tasks,
  subtasks,
  taskAssignees,
  TaskStatus,
  TaskPriority,
} from "@/shared/db/schema";

export type { TaskStatus, TaskPriority };

// ─── BASE INFERRED TYPES ──────────────────────────────────────────────────────
export type DbUser         = InferSelectModel<typeof users>;
export type DbRole         = InferSelectModel<typeof roles>;
export type DbEpic         = InferSelectModel<typeof epics>;
export type DbTask         = InferSelectModel<typeof tasks>;
export type DbSubtask      = InferSelectModel<typeof subtasks>;
export type DbTaskAssignee = InferSelectModel<typeof taskAssignees>;

export type NewUser  = InferInsertModel<typeof users>;
export type NewRole  = InferInsertModel<typeof roles>;
export type NewEpic  = InferInsertModel<typeof epics>;
export type NewTask  = InferInsertModel<typeof tasks>;

// ─── ROLE METADATA ────────────────────────────────────────────────────────────
/**
 * RoleMeta = DbRole.
 * Aliased для читаемости в компонентах.
 * Нет bgClass/textClass — используйте hexToRoleStyles(roleMeta.hex).
 */
export type RoleMeta = DbRole;

// ─── ENRICHED APPLICATION TYPES ──────────────────────────────────────────────
export interface UserWithMeta extends DbUser {
  roleMeta: RoleMeta;
}

export type SubtaskView = DbSubtask;

export interface TaskView extends DbTask {
  assignees: UserWithMeta[];
  subtasks:  SubtaskView[];
  progress:  { done: number; total: number };
}

export interface EpicWithTasks extends DbEpic {
  tasks:    TaskView[];
  progress: { done: number; total: number };
}

// ─── API RESPONSE SHAPES ──────────────────────────────────────────────────────
export interface ApiSuccess<T> { ok: true; data: T }
export interface ApiError      { ok: false; error: string; code?: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiError;