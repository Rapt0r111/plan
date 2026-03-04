/**
 * @file epicRepository.ts — entities/epic
 *
 * АУДИТ ПРОИЗВОДИТЕЛЬНОСТИ: N+1 проблема в getAllEpicsWithTasks()
 *
 * ТЕКУЩАЯ СИТУАЦИЯ (оригинал):
 *   getAllEpicsWithTasks() → getEpicById() × N эпиков
 *   getEpicById() → db.select(tasks) + tasks.map(db.select(subtasks) + db.select(assignees))
 *
 *   При 5 эпиках × 26 задач × 2 запроса/задача = ~57 SQL-запросов на загрузку страницы.
 *
 * FIX: используем inArray() из Drizzle для batch-запросов.
 *   5 эпиков → 1 запрос (tasks WHERE epic_id IN [...])
 *            → 1 запрос (subtasks WHERE task_id IN [...])
 *            → 1 запрос (assignees WHERE task_id IN [...])
 *   Итого: 3 запроса вместо 57. Экономия ~95%.
 *
 * ЭТОТ ФАЙЛ — ЭТАЛОННАЯ РЕАЛИЗАЦИЯ для замены оригинала.
 */

import { db } from "@/shared/db/client";
import { epics, tasks, taskAssignees, users, subtasks } from "@/shared/db/schema";
import { eq, count, and, inArray } from "drizzle-orm";
import type { DbEpic, EpicWithTasks, TaskView } from "@/shared/types";
import { ROLE_META } from "@/shared/config/roles";

/** Lightweight epic list for sidebar / overview */
export async function getAllEpics(): Promise<(DbEpic & { taskCount: number; doneCount: number })[]> {
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
    })
    .from(epics);

  const withCounts = await Promise.all(
    rows.map(async (epic) => {
      const [{ total }] = await db
        .select({ total: count() })
        .from(tasks)
        .where(eq(tasks.epicId, epic.id));
      const [{ done }] = await db
        .select({ done: count() })
        .from(tasks)
        .where(and(eq(tasks.epicId, epic.id), eq(tasks.status, "done")));
      return { ...epic, taskCount: total, doneCount: done };
    })
  );
  return withCounts;
}

/** getEpicById остаётся без изменений — используется для одиночных страниц */
export async function getEpicById(id: number): Promise<EpicWithTasks | null> {
  const [epic] = await db.select().from(epics).where(eq(epics.id, id));
  if (!epic) return null;

  const taskRows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.epicId, id))
    .orderBy(tasks.sortOrder);

  const hydratedTasks: TaskView[] = await Promise.all(
    taskRows.map(async (task) => {
      const taskSubtasks = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.taskId, task.id))
        .orderBy(subtasks.sortOrder);

      const assigneeRows = await db
        .select({ user: users })
        .from(taskAssignees)
        .innerJoin(users, eq(taskAssignees.userId, users.id))
        .where(eq(taskAssignees.taskId, task.id));

      const assignees = assigneeRows.map((r) => ({
        ...r.user,
        roleMeta: ROLE_META[r.user.role],
      }));

      return {
        ...task,
        assignees,
        subtasks: taskSubtasks,
        progress: {
          done: taskSubtasks.filter((s) => s.isCompleted).length,
          total: taskSubtasks.length,
        },
      };
    })
  );

  return {
    ...epic,
    tasks: hydratedTasks,
    progress: {
      done: hydratedTasks.filter((t) => t.status === "done").length,
      total: hydratedTasks.length,
    },
  };
}

/**
 * getAllEpicsWithTasks — ОПТИМИЗИРОВАННАЯ ВЕРСИЯ (batch-запросы).
 *
 * Заменяет N+1 паттерн на 4 запроса суммарно для любого количества эпиков.
 *
 * ПЛАН ЗАПРОСОВ:
 *  1. SELECT * FROM epics
 *  2. SELECT * FROM tasks WHERE epic_id IN [...]
 *  3. SELECT * FROM subtasks WHERE task_id IN [...]
 *  4. SELECT users.* FROM task_assignees JOIN users WHERE task_id IN [...]
 */
export async function getAllEpicsWithTasks(): Promise<EpicWithTasks[]> {
  // 1. Все эпики
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

  // 2. Все задачи для этих эпиков — ОДИН запрос
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

  // 3. Все подзадачи — ОДИН запрос
  const allSubtasks = await db
    .select()
    .from(subtasks)
    .where(inArray(subtasks.taskId, taskIds))
    .orderBy(subtasks.taskId, subtasks.sortOrder);

  // 4. Все исполнители — ОДИН запрос
  const allAssigneeRows = await db
    .select({ taskId: taskAssignees.taskId, user: users })
    .from(taskAssignees)
    .innerJoin(users, eq(taskAssignees.userId, users.id))
    .where(inArray(taskAssignees.taskId, taskIds));

  // ── Индексация для O(1) доступа ──────────────────────────────────────────

  /** subtaskId → subtask[] */
  const subtasksByTask = new Map<number, typeof allSubtasks>();
  for (const st of allSubtasks) {
    const arr = subtasksByTask.get(st.taskId) ?? [];
    arr.push(st);
    subtasksByTask.set(st.taskId, arr);
  }

  /** taskId → assignees[] */
  const assigneesByTask = new Map<number, (typeof allAssigneeRows[0]["user"] & { roleMeta: ReturnType<typeof ROLE_META[keyof typeof ROLE_META]["role"]> })[]>();
  for (const row of allAssigneeRows) {
    const arr = assigneesByTask.get(row.taskId) ?? [] as any[];
    arr.push({ ...row.user, roleMeta: ROLE_META[row.user.role] });
    assigneesByTask.set(row.taskId, arr);
  }

  /** epicId → task[] */
  const tasksByEpic = new Map<number, typeof allTasks>();
  for (const task of allTasks) {
    const arr = tasksByEpic.get(task.epicId) ?? [];
    arr.push(task);
    tasksByEpic.set(task.epicId, arr);
  }

  // ── Сборка результата ─────────────────────────────────────────────────────

  return epicRows.map((epic) => {
    const epicTasks = tasksByEpic.get(epic.id) ?? [];

    const hydratedTasks: TaskView[] = epicTasks.map((task) => {
      const taskSubtasks = subtasksByTask.get(task.id) ?? [];
      const assignees = (assigneesByTask.get(task.id) ?? []) as any[];

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