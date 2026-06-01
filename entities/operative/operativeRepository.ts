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
 *    БЫЛО: новые задачи получали нижний order или конфликтовали с DnD
 *    СТАЛО: order = MIN(order) - 1 для данного userId
 *    Новые задачи добавляются сверху своей категории и не сбивают DnD.
 *
 * 4. Новая функция updateUserBlockOrders — атомарно обновляет `block_order`
 *    для нескольких пользователей в одной транзакции.
 */

import { db } from "@/shared/db/client";
import { operativeTaskComments, operativeTasks, operativeSubtasks, users, roles, personnelGroups } from "@/shared/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type { UserWithMeta } from "@/shared/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DbOperativeTask = InferSelectModel<typeof operativeTasks>;
export type DbOperativeSubtask = InferSelectModel<typeof operativeSubtasks>;
export type DbOperativeTaskComment = InferSelectModel<typeof operativeTaskComments>;
export type OperativeTaskStatus = DbOperativeTask["status"];

export interface OperativeSubtaskView {
  id: number;
  taskId: number;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface OperativeTaskCommentView {
  id: number;
  taskId: number;
  authorUserId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface OperativeTaskView extends DbOperativeTask {
  subtasks: OperativeSubtaskView[];
  comments: OperativeTaskCommentView[];
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
export async function getAllUsersWithOperativeTasks(options: {
  personnelGroupKey?: string | null;
} = {}): Promise<UserWithOperativeTasks[]> {
  // 1. Все пользователи с ролями, отсортированные по blockOrder (DnD-порядок блоков)
  const userQuery = db
    .select({
      id: users.id,
      name: users.name,
      login: users.login,
      roleId: users.roleId,
      initials: users.initials,
      createdAt: users.createdAt,
      blockOrder: users.blockOrder,
      authUserId: users.authUserId,
      accountStatus: users.accountStatus,
      legacyLoginAlias: users.legacyLoginAlias,
      role: {
        id: roles.id,
        key: roles.key,
        label: roles.label,
        short: roles.short,
        hex: roles.hex,
        description: roles.description,
        composition: roles.composition,
        personnelGroupId: roles.personnelGroupId,
        permissionsJson: roles.permissionsJson,
        sortOrder: roles.sortOrder,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
      },
      personnelGroup: personnelGroups,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(personnelGroups, eq(roles.personnelGroupId, personnelGroups.id))
    .$dynamic();

  const filteredUserQuery = options.personnelGroupKey
    ? userQuery.where(eq(personnelGroups.key, options.personnelGroupKey))
    : userQuery;

  const userRows = await filteredUserQuery
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

  const commentRows = taskIds.length
    ? await db
      .select()
      .from(operativeTaskComments)
      .where(inArray(operativeTaskComments.taskId, taskIds))
      .orderBy(operativeTaskComments.taskId, desc(operativeTaskComments.createdAt), desc(operativeTaskComments.id))
    : [];

  // 4. Индексы
  const subtasksByTask = new Map<number, DbOperativeSubtask[]>();
  for (const st of subtaskRows) {
    const arr = subtasksByTask.get(st.taskId) ?? [];
    arr.push(st);
    subtasksByTask.set(st.taskId, arr);
  }

  const commentsByTask = new Map<number, DbOperativeTaskComment[]>();
  for (const comment of commentRows) {
    const arr = commentsByTask.get(comment.taskId) ?? [];
    arr.push(comment);
    commentsByTask.set(comment.taskId, arr);
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
      authUserId: row.authUserId,
      accountStatus: row.accountStatus,
      legacyLoginAlias: row.legacyLoginAlias,
      createdAt: row.createdAt,
      blockOrder: row.blockOrder, // <--- ДОБАВЛЕНО ЭТО ПОЛЕ
      roleMeta: { ...row.role, personnelGroup: row.personnelGroup },
    };

    const userTasks: OperativeTaskView[] = (tasksByUser.get(row.id) ?? []).map(t => {
      const subs = (subtasksByTask.get(t.id) ?? []) as OperativeSubtaskView[];
      const comments = (commentsByTask.get(t.id) ?? []) as OperativeTaskCommentView[];
      return {
        ...t,
        subtasks: subs,
        comments,
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

  const comments = (await db
    .select()
    .from(operativeTaskComments)
    .where(eq(operativeTaskComments.taskId, id))
    .orderBy(desc(operativeTaskComments.createdAt), desc(operativeTaskComments.id))) as OperativeTaskCommentView[];

  return {
    ...task,
    subtasks: subs,
    comments,
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
 * ИСПРАВЛЕНИЕ: `order` теперь = MIN(order) - 1 для данного userId.
 * Это гарантирует, что новые задачи (независимо от способа создания:
 * через Server Action или API route) всегда появляются сверху своей категории,
 * а DnD-порядок существующих задач остаётся стабильным.
 */
export async function createOperativeTask(data: {
  userId: number;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  sortOrder?: number;
}): Promise<DbOperativeTask> {
  const [minRow] = await db
    .select({ minOrder: sql<number>`MIN("order")`.mapWith(Number) })
    .from(operativeTasks)
    .where(eq(operativeTasks.userId, data.userId));

  const nextOrder = (minRow?.minOrder ?? 1) - 1;

  const [row] = await db
    .insert(operativeTasks)
    .values({
      userId: data.userId,
      title: data.title,
      description: data.description ?? null,
      dueDate: data.dueDate ?? null,
      sortOrder: data.sortOrder ?? nextOrder,
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

export async function createOperativeTaskComment(data: {
  taskId: number;
  body: string;
  authorUserId?: string | null;
  authorName?: string | null;
}): Promise<DbOperativeTaskComment> {
  const [row] = await db
    .insert(operativeTaskComments)
    .values({
      taskId: data.taskId,
      body: data.body,
      authorUserId: data.authorUserId ?? null,
      authorName: data.authorName?.trim() || "Гость",
    })
    .returning();
  return row;
}
