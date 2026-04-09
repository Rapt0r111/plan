/**
 * @file operativeRepository.ts — entities/operative
 *
 * Репозиторий оперативных задач.
 * КЛЮЧЕВЫЕ ПРАВИЛА:
 *  - Удаление задач и подзадач ЗАПРЕЩЕНО (нет deleteOperativeTask/deleteOperativeSubtask).
 *  - Разрешено: создание, смена статуса, добавление подзадач, отметка подзадач.
 *
 * Оперативные задачи привязаны к пользователям — при добавлении/удалении
 * пользователя в настройках их блок автоматически появляется/убирается.
 */

import { db } from "@/shared/db/client";
import { operativeTasks, operativeSubtasks, users, roles } from "@/shared/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type { UserWithMeta } from "@/shared/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DbOperativeTask     = InferSelectModel<typeof operativeTasks>;
export type DbOperativeSubtask  = InferSelectModel<typeof operativeSubtasks>;
export type OperativeTaskStatus = DbOperativeTask["status"];

export interface OperativeSubtaskView {
  id:          number;
  taskId:      number;
  title:       string;
  isCompleted: boolean;
  sortOrder:   number;
  createdAt:   string;
}

export interface OperativeTaskView extends DbOperativeTask {
  subtasks: OperativeSubtaskView[];
  progress: { done: number; total: number };
}

export interface UserWithOperativeTasks {
  user:  UserWithMeta;
  tasks: OperativeTaskView[];
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * getAllUsersWithOperativeTasks — возвращает ВСЕХ пользователей (в том числе
 * без задач), чтобы отображать блок для каждого, даже если задач ещё нет.
 */
export async function getAllUsersWithOperativeTasks(): Promise<UserWithOperativeTasks[]> {
  // 1. Все пользователи с ролями
  const userRows = await db
    .select({
      id:        users.id,
      name:      users.name,
      login:     users.login,
      roleId:    users.roleId,
      initials:  users.initials,
      createdAt: users.createdAt,
      role: {
        id:          roles.id,
        key:         roles.key,
        label:       roles.label,
        short:       roles.short,
        hex:         roles.hex,
        description: roles.description,
        sortOrder:   roles.sortOrder,
        createdAt:   roles.createdAt,
        updatedAt:   roles.updatedAt,
      },
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(roles.sortOrder, users.name);

  if (!userRows.length) return [];

  const userIds = userRows.map((u) => u.id);

  // 2. Все оперативные задачи для этих пользователей
  const taskRows = await db
    .select()
    .from(operativeTasks)
    .where(inArray(operativeTasks.userId, userIds))
    .orderBy(operativeTasks.userId, operativeTasks.sortOrder, operativeTasks.createdAt);

  // 3. Все подзадачи для этих задач
  const taskIds = taskRows.map((t) => t.id);
  const subtaskRows = taskIds.length
    ? await db
        .select()
        .from(operativeSubtasks)
        .where(inArray(operativeSubtasks.taskId, taskIds))
        .orderBy(operativeSubtasks.taskId, operativeSubtasks.sortOrder)
    : [];

  // 4. Индексы
  const subtasksByTask = new Map<number, DbOperativeSubtask[]>();
  for (const st of subtaskRows) {
    const arr = subtasksByTask.get(st.taskId) ?? [];
    arr.push(st);
    subtasksByTask.set(st.taskId, arr);
  }

  const tasksByUser = new Map<number, DbOperativeTask[]>();
  for (const t of taskRows) {
    const arr = tasksByUser.get(t.userId) ?? [];
    arr.push(t);
    tasksByUser.set(t.userId, arr);
  }

  // 5. Сборка результата
  return userRows.map((row) => {
    const userMeta: UserWithMeta = {
      id:        row.id,
      name:      row.name,
      login:     row.login,
      roleId:    row.roleId,
      initials:  row.initials,
      createdAt: row.createdAt,
      roleMeta:  row.role,
    };

    const userTasks: OperativeTaskView[] = (tasksByUser.get(row.id) ?? []).map((t) => {
      const subs = (subtasksByTask.get(t.id) ?? []) as OperativeSubtaskView[];
      return {
        ...t,
        subtasks: subs,
        progress: {
          done:  subs.filter((s) => s.isCompleted).length,
          total: subs.length,
        },
      };
    });

    return { user: userMeta, tasks: userTasks };
  });
}

export async function getOperativeTaskById(id: number): Promise<OperativeTaskView | null> {
  const [task] = await db
    .select()
    .from(operativeTasks)
    .where(eq(operativeTasks.id, id));

  if (!task) return null;

  const subs = (await db
    .select()
    .from(operativeSubtasks)
    .where(eq(operativeSubtasks.taskId, id))
    .orderBy(operativeSubtasks.sortOrder)) as OperativeSubtaskView[];

  return {
    ...task,
    subtasks: subs,
    progress: { done: subs.filter((s) => s.isCompleted).length, total: subs.length },
  };
}

// ─── Write — Tasks ────────────────────────────────────────────────────────────

export async function createOperativeTask(data: {
  userId:      number;
  title:       string;
  description?: string | null;
  sortOrder?:  number;
}): Promise<DbOperativeTask> {
  const [row] = await db
    .insert(operativeTasks)
    .values({
      userId:      data.userId,
      title:       data.title,
      description: data.description ?? null,
      sortOrder:   data.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateOperativeTaskStatus(
  id:     number,
  status: OperativeTaskStatus,
): Promise<DbOperativeTask> {
  const [row] = await db
    .update(operativeTasks)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(operativeTasks.id, id))
    .returning();
  if (!row) throw new Error(`Operative task ${id} not found`);
  return row;
}

// ─── Write — Subtasks ─────────────────────────────────────────────────────────

export async function createOperativeSubtask(data: {
  taskId:    number;
  title:     string;
  sortOrder?: number;
}): Promise<DbOperativeSubtask> {
  // Вычисляем следующий sortOrder
  const existing = await db
    .select({ sortOrder: operativeSubtasks.sortOrder })
    .from(operativeSubtasks)
    .where(eq(operativeSubtasks.taskId, data.taskId));

  const maxOrder = existing.reduce((m, s) => Math.max(m, s.sortOrder), -1);

  const [row] = await db
    .insert(operativeSubtasks)
    .values({
      taskId:    data.taskId,
      title:     data.title,
      sortOrder: data.sortOrder ?? maxOrder + 1,
    })
    .returning();
  return row;
}

export async function toggleOperativeSubtask(
  id:          number,
  isCompleted: boolean,
): Promise<DbOperativeSubtask> {
  const [row] = await db
    .update(operativeSubtasks)
    .set({ isCompleted })
    .where(eq(operativeSubtasks.id, id))
    .returning();
  if (!row) throw new Error(`Operative subtask ${id} not found`);
  return row;
}