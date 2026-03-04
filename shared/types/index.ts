/**
 * @file index.ts — shared/types
 */

import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  epics,
  tasks,
  subtasks,
  taskAssignees,
  Role,
  TaskStatus,
  TaskPriority,
} from "@/shared/db/schema";

export type { Role, TaskStatus, TaskPriority };

// ─── BASE INFERRED TYPES ──────────────────────────────────────────────────────
export type DbUser = InferSelectModel<typeof users>;
export type DbEpic = InferSelectModel<typeof epics>;
export type DbTask = InferSelectModel<typeof tasks>;
export type DbSubtask = InferSelectModel<typeof subtasks>;
export type DbTaskAssignee = InferSelectModel<typeof taskAssignees>;

export type NewUser = InferInsertModel<typeof users>;
export type NewEpic = InferInsertModel<typeof epics>;
export type NewTask = InferInsertModel<typeof tasks>;
export type NewSubtask = InferInsertModel<typeof subtasks>;
export type NewTaskAssignee = InferInsertModel<typeof taskAssignees>;

// ─── ROLE METADATA ───────────────────────────────────────────────────────────

export interface RoleMeta {
  role: Role;
  label: string;
  short: string;      // Инициалы для UI
  bgClass: string;
  textClass: string;
  borderClass: string;
  hex: string;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  company_commander:   { role: "company_commander",   label: "Командир роты",      short: "КНР",  bgClass: "bg-violet-100",  textClass: "text-violet-800",  borderClass: "border-violet-300",  hex: "#7c3aed" },
  deputy_commander:    { role: "deputy_commander",    label: "Зам. КР",            short: "ЗКВ",  bgClass: "bg-sky-100",     textClass: "text-sky-800",     borderClass: "border-sky-300",     hex: "#0284c7" },
  platoon_1_commander: { role: "platoon_1_commander", label: "Командир 1 взвода",  short: "КВ1",  bgClass: "bg-teal-100",    textClass: "text-teal-800",    borderClass: "border-teal-300",    hex: "#0d9488" },
  platoon_2_commander: { role: "platoon_2_commander", label: "Командир 2 взвода",  short: "КВ2",  bgClass: "bg-emerald-100", textClass: "text-emerald-800", borderClass: "border-emerald-300", hex: "#059669" },
  deputy_platoon_1:    { role: "deputy_platoon_1",    label: "Зам. ком. 1 взв.",   short: "ЗКВ1", bgClass: "bg-blue-100",    textClass: "text-blue-800",    borderClass: "border-blue-300",    hex: "#2563eb" },
  deputy_platoon_2:    { role: "deputy_platoon_2",    label: "Зам. ком. 2 взв.",   short: "ЗКВ2", bgClass: "bg-blue-100",    textClass: "text-blue-800",    borderClass: "border-blue-300",    hex: "#2563eb" },
  squad_commander_2:   { role: "squad_commander_2",   label: "КО 2 отд.",          short: "КО2",  bgClass: "bg-zinc-100",    textClass: "text-zinc-800",    borderClass: "border-zinc-300",    hex: "#71717a" },
  sergeant_major:      { role: "sergeant_major",      label: "Старшина",           short: "СР",   bgClass: "bg-amber-100",   textClass: "text-amber-800",   borderClass: "border-amber-300",   hex: "#d97706" },
  security_officer:    { role: "security_officer",    label: "Ответств. ЗГТ",      short: "ЗГТ",  bgClass: "bg-rose-100",    textClass: "text-rose-800",    borderClass: "border-rose-300",    hex: "#e11d48" },
  research_officer:    { role: "research_officer",    label: "Ответств. НИР",      short: "НИР",  bgClass: "bg-indigo-100",  textClass: "text-indigo-800",  borderClass: "border-indigo-300",  hex: "#4f46e5" },
  duty_officer:        { role: "duty_officer",        label: "Дежурный",           short: "ПС",   bgClass: "bg-slate-100",   textClass: "text-slate-700",   borderClass: "border-slate-300",   hex: "#475569" },
} as const;

// ─── ENRICHED APPLICATION TYPES ──────────────────────────────────────────────

export interface UserWithMeta extends DbUser {
  roleMeta: RoleMeta;
}

export type SubtaskView = DbSubtask;

export interface TaskView extends DbTask {
  assignees: UserWithMeta[];
  subtasks: SubtaskView[];
  progress: { done: number; total: number };
}

export interface EpicWithTasks extends DbEpic {
  tasks: TaskView[];
  progress: { done: number; total: number };
}

// ─── API RESPONSE SHAPES ──────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface TaskFilters {
  epicId?: number;
  assigneeId?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
}