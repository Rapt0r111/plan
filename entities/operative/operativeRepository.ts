/**
 * @file operativeRepository.ts — entities/operative
 *
 * ИСПРАВЛЕНИЯ v4:
 *
 * 1. Порядок пользовательских блоков:
 *    БЫЛО: .orderBy(roles.sortOrder, users.name) — не учитывал DnD
 *    СТАЛО: .orderBy(users.blockOrder, roles.sortOrder, users.name)
 *    Поле `block_order` обновляется через PATCH /api/operative-blocks
 *    при перетаскивании блоков → порядок сохраняется между сессиями
 *    и виден всем участникам.
 *
 * 2. Порядок задач внутри блока:
 *    БЫЛО: .orderBy(operativeTasks.userId, operativeTasks.sortOrder, ...)
 *    СТАЛО: .orderBy(operativeTasks.userId, operativeTasks.order, ...)
 *    Поле `order` — именно то, что обновляет updateOrderAction при DnD.
 *    Без этой правки порядок задач всегда сбрасывался после reload.
 *
 * 3. createOperativeTask:
 *    БЫЛО: order всегда 0 → новые задачи кластеризовались в начале списка
 *    СТАЛО: order = MAX(order) + 1 для данного userId
 *    Новые задачи добавляются в конец списка независимо от способа создания.
 *
 * 4. Новая функция updateUserBlockOrders — атомарно обновляет `block_order`
 *    для нескольких пользователей в одной транзакции.
 */

import { db } from "@/shared/db/client";
import { operativeTasks, operativeSubtasks, users, roles } from "@/shared/db/schema";
import { eq, inArray, sql, max } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type { UserWithMeta } from "@/shared/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DbOperativeTask = InferSelectModel<typeof operativeTasks>;
export type DbOperativeSubtask = InferSelectModel<typeof operativeSubtasks>;
export type OperativeTaskStatus = DbOperativeTask["status"];

export interface OperativeSubtaskView {
  id: number;
  taskId: number;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface OperativeTaskView extends DbOperativeTask {
  subtasks: OperativeSubtaskView[];
  progress: { done: number; total: number };
}

export interface UserWithOperativeTasks {
  user: UserWithMeta;
  tasks: OperativeTaskView[];
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * getAllUsersWithOperativeTasks — возвращает ВСЕХ пользователей (включая
 * без задач), отсортированных по `block_order` (DnD-порядок, общий для всех).
 *
 * ИСПРАВЛЕНИЕ: порядок пользователей теперь читается из поля `block_order`,
 * которое обновляется через PATCH /api/operative-blocks.
 * Задачи внутри блока сортируются по полю `order` (DnD внутри блока).
 */
export async function getAllUsersWithOperativeTasks(): Promise<UserWithOperativeTasks[]> {
  // 1. Все пользователи с ролями, отсортированные по blockOrder (DnD-порядок блоков)
  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      login: users.login,
      roleId: users.roleId,
      initials: users.initials,
      createdAt: users.createdAt,
      blockOrder: users.blockOrder,
      role: {
        id: roles.id,
        key: roles.key,
        label: roles.label,
        short: roles.short,
        hex: roles.hex,
        description: roles.description,
        sortOrder: roles.sortOrder,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
      },
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    // ИСПРАВЛЕНО: сначала по blockOrder (DnD), затем fallback
    .orderBy(users.blockOrder, roles.sortOrder, users.name);

  if (!userRows.length) return [];

  const userIds = userRows.map(u => u.id);

  // 2. Все оперативные задачи, отсортированные по полю `order` (DnD внутри блока)
  // ИСПРАВЛЕНО: используем operativeTasks.order, а не sortOrder
  const taskRows = await db
    .select()
    .from(operativeTasks)
    .where(inArray(operativeTasks.userId, userIds))
    // ИСПРАВЛЕНО: order — поле, обновляемое updateOrderAction при DnD
    .orderBy(operativeTasks.userId, operativeTasks.order, operativeTasks.createdAt);

  // 3. Все подзадачи
  const taskIds = taskRows.map(t => t.id);
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

  // 5. Сборка — порядок userRows уже правильный (по blockOrder)
  return userRows.map(row => {
    const userMeta: UserWithMeta = {
      id: row.id,
      name: row.name,
      login: row.login,
      roleId: row.roleId,
      initials: row.initials,
      createdAt: row.createdAt,
      blockOrder: row.blockOrder, // <--- ДОБАВЛЕНО ЭТО ПОЛЕ
      roleMeta: row.role,
    };

    const userTasks: OperativeTaskView[] = (tasksByUser.get(row.id) ?? []).map(t => {
      const subs = (subtasksByTask.get(t.id) ?? []) as OperativeSubtaskView[];
      return {
        ...t,
        subtasks: subs,
        progress: {
          done: subs.filter(s => s.isCompleted).length,
          total: subs.length,
        },
      };
    });

    return { user: userMeta, tasks: userTasks };
  });
}

export async function getOperativeTaskById(id: number): Promise<OperativeTaskView | null> {
  const [task] = await db.select().from(operativeTasks).where(eq(operativeTasks.id, id));
  if (!task) return null;

  const subs = (await db
    .select()
    .from(operativeSubtasks)
    .where(eq(operativeSubtasks.taskId, id))
    .orderBy(operativeSubtasks.sortOrder)) as OperativeSubtaskView[];

  return {
    ...task,
    subtasks: subs,
    progress: { done: subs.filter(s => s.isCompleted).length, total: subs.length },
  };
}

// ─── Write — User Block Order ─────────────────────────────────────────────────

/**
 * updateUserBlockOrders — атомарно обновляет `block_order` для набора пользователей.
 *
 * Вызывается из PATCH /api/operative-blocks когда администратор
 * перетаскивает блок пользователя на странице оперативных задач.
 * После обновления новый порядок виден ВСЕМ участникам системы.
 */
export async function updateUserBlockOrders(
  items: { id: number; blockOrder: number }[]
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const { id, blockOrder } of items) {
      await tx
        .update(users)
        .set({ blockOrder })
        .where(eq(users.id, id));
    }
  });
}

// ─── Write — Tasks ────────────────────────────────────────────────────────────

/**
 * createOperativeTask — создаёт задачу с правильным `order`.
 *
 * ИСПРАВЛЕНИЕ: `order` теперь = MAX(order) + 1 для данного userId.
 * Это гарантирует, что новые задачи (независимо от способа создания:
 * через Server Action или API route) всегда появляются в конце списка,
 * а не сбрасывают DnD-порядок существующих задач.
 */
export async function createOperativeTask(data: {
  userId: number;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  sortOrder?: number;
}): Promise<DbOperativeTask> {
  // Вычисляем следующее значение order для данного пользователя
  const [maxRow] = await db
    .select({ maxOrder: sql<number>`MAX("order")`.mapWith(Number) })
    .from(operativeTasks)
    .where(eq(operativeTasks.userId, data.userId));

  const nextOrder = (maxRow?.maxOrder ?? -1) + 1;

  const [row] = await db
    .insert(operativeTasks)
    .values({
      userId: data.userId,
      title: data.title,
      description: data.description ?? null,
      dueDate: data.dueDate ?? null,
      sortOrder: data.sortOrder ?? nextOrder,
      // ИСПРАВЛЕНО: order = nextOrder, а не 0
      // Без этого все задачи, созданные через API route, получали order: 0
      // и после DnD кластеризовались в начале списка
      order: nextOrder,
    })
    .returning();
  return row;
}

export async function updateOperativeTaskStatus(
  id: number,
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

export async function updateOperativeTaskDueDate(
  id: number,
  dueDate: string | null,
): Promise<DbOperativeTask> {
  const [row] = await db
    .update(operativeTasks)
    .set({ dueDate, updatedAt: new Date().toISOString() })
    .where(eq(operativeTasks.id, id))
    .returning();
  if (!row) throw new Error(`Operative task ${id} not found`);
  return row;
}

// ─── Write — Subtasks ─────────────────────────────────────────────────────────

export async function createOperativeSubtask(data: {
  taskId: number;
  title: string;
  sortOrder?: number;
}): Promise<DbOperativeSubtask> {
  const existing = await db
    .select({ sortOrder: operativeSubtasks.sortOrder })
    .from(operativeSubtasks)
    .where(eq(operativeSubtasks.taskId, data.taskId));

  const maxOrder = existing.reduce((m, s) => Math.max(m, s.sortOrder), -1);

  const [row] = await db
    .insert(operativeSubtasks)
    .values({
      taskId: data.taskId,
      title: data.title,
      sortOrder: data.sortOrder ?? maxOrder + 1,
    })
    .returning();
  return row;
}

export async function toggleOperativeSubtask(
  id: number,
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