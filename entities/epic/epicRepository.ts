/**
 * @file epicRepository.ts — entities/epic
 *
 * РЕФАКТОРИНГ v3 — исправление кеша для мутаций:
 *
 *   БЫЛА ОШИБКА: директива "use cache" на уровне файла означает, что
 *   ВСЕ экспортируемые функции, включая мутации (createEpic, updateEpic,
 *   deleteEpic), автоматически кешируются. Это сводит на нет смысл мутаций —
 *   повторный вызов возвращал бы закешированный результат вместо записи в БД.
 *
 *   ИСПРАВЛЕНО: файловая директива удалена. "use cache" оставлена только
 *   внутри каждой READ-функции. Мутации остаются некешированными.
 */

import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/shared/db/client";
import { epics, tasks, taskAssignees, users, subtasks, roles } from "@/shared/db/schema";
import { eq, inArray, sql, count } from "drizzle-orm";
import type { DbEpic, EpicWithTasks, TaskView, UserWithMeta, SubtaskView } from "@/shared/types";

export const EPICS_CACHE_TAG = "epics";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (не кешируются напрямую — вызываются только из кешированных функций)
// ─────────────────────────────────────────────────────────────────────────────

type AssigneeRow = {
  taskId: number;
  user: typeof users.$inferSelect;
  role: typeof roles.$inferSelect;
};

function buildAssigneesByTask(rows: AssigneeRow[]): Map<number, UserWithMeta[]> {
  const map = new Map<number, UserWithMeta[]>();
  for (const row of rows) {
    const arr = map.get(row.taskId) ?? [];
    arr.push({ ...row.user, roleMeta: row.role });
    map.set(row.taskId, arr);
  }
  return map;
}

async function fetchAssignees(taskIds: number[]): Promise<AssigneeRow[]> {
  return db
    .select({
      taskId: taskAssignees.taskId,
      user: {
        id: users.id,
        name: users.name,
        login: users.login,
        roleId: users.roleId,
        initials: users.initials,
        createdAt: users.createdAt,
      },
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
    .from(taskAssignees)
    .innerJoin(users, eq(taskAssignees.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(inArray(taskAssignees.taskId, taskIds));
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllEpics — лёгкий список для сайдбара и карточек дашборда
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllEpics(): Promise<(DbEpic & { taskCount: number; doneCount: number })[]> {
  cacheTag(EPICS_CACHE_TAG);
  cacheLife({ revalidate: 120 }); // 2 минуты — лёгкие данные

  const rows = await db
    .select({
      id: epics.id,
      title: epics.title,
      description: epics.description,
      color: epics.color,
      startDate: epics.startDate,
      endDate: epics.endDate,
      createdAt: epics.createdAt,
      updatedAt: epics.updatedAt,
      taskCount: count(tasks.id),
      doneCount: sql<number>`
        CAST(COUNT(CASE WHEN ${tasks.status} = 'done' THEN 1 END) AS INTEGER)
      `.mapWith(Number),
    })
    .from(epics)
    .leftJoin(tasks, eq(tasks.epicId, epics.id))
    .groupBy(
      epics.id, epics.title, epics.description, epics.color,
      epics.startDate, epics.endDate, epics.createdAt, epics.updatedAt,
    );

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// getEpicById — страница одного эпика
// ─────────────────────────────────────────────────────────────────────────────

export async function getEpicById(id: number): Promise<EpicWithTasks | null> {
  cacheTag(EPICS_CACHE_TAG);
  cacheLife({ revalidate: 30 }); // 30 секунд — нужна высокая свежесть

  const [epic] = await db.select().from(epics).where(eq(epics.id, id));
  if (!epic) return null;

  const taskRows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.epicId, id))
    .orderBy(tasks.sortOrder);

  if (!taskRows.length) {
    return { ...epic, tasks: [], progress: { done: 0, total: 0 } };
  }

  const taskIds = taskRows.map((t) => t.id);

  const [allSubtasks, allAssigneeRows] = await Promise.all([
    db
      .select()
      .from(subtasks)
      .where(inArray(subtasks.taskId, taskIds))
      .orderBy(subtasks.taskId, subtasks.sortOrder),
    fetchAssignees(taskIds),
  ]);

  const subtasksByTask = new Map<number, SubtaskView[]>();
  for (const st of allSubtasks) {
    const arr = subtasksByTask.get(st.taskId) ?? [];
    arr.push(st);
    subtasksByTask.set(st.taskId, arr);
  }

  const assigneesByTask = buildAssigneesByTask(allAssigneeRows);

  const hydratedTasks: TaskView[] = taskRows.map((task) => {
    const taskSubtasks = subtasksByTask.get(task.id) ?? [];
    const assignees = assigneesByTask.get(task.id) ?? [];
    return {
      ...task,
      assignees,
      subtasks: taskSubtasks,
      progress: {
        done: taskSubtasks.filter((s) => s.isCompleted).length,
        total: taskSubtasks.length,
      },
    };
  });

  return {
    ...epic,
    tasks: hydratedTasks,
    progress: {
      done: hydratedTasks.filter((t) => t.status === "done").length,
      total: hydratedTasks.length,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllEpicsWithTasks — полный граф для Zustand store
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllEpicsWithTasks(): Promise<EpicWithTasks[]> {
  cacheTag(EPICS_CACHE_TAG);
  cacheLife({ revalidate: 60 }); // 1 минута — тяжёлый запрос

  const epicRows = await db
    .select({
      id: epics.id,
      title: epics.title,
      description: epics.description,
      color: epics.color,
      startDate: epics.startDate,
      endDate: epics.endDate,
      createdAt: epics.createdAt,
      updatedAt: epics.updatedAt,
    })
    .from(epics);

  if (!epicRows.length) return [];

  const epicIds = epicRows.map((e) => e.id);

  const allTasks = await db
    .select()
    .from(tasks)
    .where(inArray(tasks.epicId, epicIds))
    .orderBy(tasks.epicId, tasks.sortOrder);

  if (!allTasks.length) {
    return epicRows.map((epic) => ({
      ...epic,
      tasks: [],
      progress: { done: 0, total: 0 },
    }));
  }

  const taskIds = allTasks.map((t) => t.id);

  const [subtasksRows, assigneeRows] = await Promise.all([
    db
      .select()
      .from(subtasks)
      .where(inArray(subtasks.taskId, taskIds))
      .orderBy(subtasks.taskId, subtasks.sortOrder),
    fetchAssignees(taskIds),
  ]);

  const subtasksByTask = new Map<number, SubtaskView[]>();
  for (const st of subtasksRows) {
    const arr = subtasksByTask.get(st.taskId) ?? [];
    arr.push(st);
    subtasksByTask.set(st.taskId, arr);
  }

  const assigneesByTask = buildAssigneesByTask(assigneeRows);

  type TaskRow = (typeof allTasks)[number];
  const tasksByEpic = new Map<number, TaskRow[]>();
  for (const task of allTasks) {
    const arr = tasksByEpic.get(task.epicId) ?? [];
    arr.push(task);
    tasksByEpic.set(task.epicId, arr);
  }

  return epicRows.map((epic) => {
    const epicTasks = tasksByEpic.get(epic.id) ?? [];

    const hydratedTasks: TaskView[] = epicTasks.map((task) => {
      const taskSubtasks = subtasksByTask.get(task.id) ?? [];
      const assignees = assigneesByTask.get(task.id) ?? [];
      return {
        ...task,
        assignees,
        subtasks: taskSubtasks,
        progress: {
          done: taskSubtasks.filter((s) => s.isCompleted).length,
          total: taskSubtasks.length,
        },
      };
    });

    return {
      ...epic,
      tasks: hydratedTasks,
      progress: {
        done: hydratedTasks.filter((t) => t.status === "done").length,
        total: hydratedTasks.length,
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Мутации — "use cache" НЕ применяется.
// revalidateTag вызывается из Route Handler'ов / Server Actions после мутации.
// ─────────────────────────────────────────────────────────────────────────────

export async function createEpic(data: {
  title: string;
  description?: string | null;
  color?: string;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<DbEpic> {
  const [row] = await db
    .insert(epics)
    .values({
      title: data.title,
      description: data.description ?? null,
      color: data.color ?? "#8b5cf6",
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
    })
    .returning();
  return row;
}

export async function updateEpic(
  id: number,
  data: Partial<{
    title: string;
    description: string | null;
    color: string;
    startDate: string | null;
    endDate: string | null;
  }>
): Promise<DbEpic> {
  const [row] = await db
    .update(epics)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(epics.id, id))
    .returning();
  if (!row) throw new Error(`Epic ${id} not found`);
  return row;
}

export async function deleteEpic(id: number): Promise<void> {
  await db.delete(epics).where(eq(epics.id, id));
}