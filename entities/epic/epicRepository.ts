/**
 * @file epicRepository.ts — entities/epic
 *
 * ═══════════════════════════════════════════════════════════════
 * PERFORMANCE AUDIT — v2
 * ═══════════════════════════════════════════════════════════════
 *
 * БЫЛО (v1):
 *   getAllEpics()          → SELECT epics + N×2 COUNT запросов       = 2N+1 SQL
 *   getAllEpicsWithTasks()  → SELECT epics + N×tasks + M×2 sub/assign = ~57 SQL
 *   Вызывалось дважды на /dashboard (layout + page) без дедупликации
 *
 * СТАЛО (v2):
 *   getAllEpics()          → 1 SQL (LEFT JOIN + GROUP BY + CASE WHEN)
 *   getAllEpicsWithTasks()  → 3 SQL (batch inArray, два из них параллельно)
 *   React.cache()          → дедупликация внутри рендер-прохода
 *   unstable_cache()       → кеш между запросами, тег "epics", TTL=30s
 *
 * ─── ИСПРАВЛЕНИЕ ТИПОВ ────────────────────────────────────────────────────────
 * Проблема: Map<number, any[]> и { ...row.user, roleMeta: ... } давали
 *   "Unexpected any" и тот же конфликт Role vs DbRole что в userRepository.
 *
 * Решение:
 *   1. Вспомогательная функция toUserWithMeta() — явный тип без any.
 *   2. { ...meta, role: u.role } — та же техника что в userRepository:
 *      переписываем roleMeta.role значением из БД, чтобы сузить тип.
 *   3. Map<number, UserWithMeta[]> и Map<number, SubtaskView[]> вместо any[].
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/shared/db/client";
import { epics, tasks, taskAssignees, users, subtasks } from "@/shared/db/schema";
import { eq, inArray, sql, count } from "drizzle-orm";
import type { DbEpic, EpicWithTasks, TaskView, UserWithMeta, SubtaskView } from "@/shared/types";
import { ROLE_META } from "@/shared/config/roles";

export const EPICS_CACHE_TAG = "epics";
const CACHE_TTL = 30;

// ─── Вспомогательный тип для JOIN-строки ─────────────────────────────────────
// Drizzle возвращает users как InferSelectModel<typeof users> — берём его напрямую,
// чтобы не дублировать поля вручную и не получать implicit any.
type JoinedUser = typeof users.$inferSelect;

/**
 * Превращает JOIN-строку в UserWithMeta без any.
 *
 * Явно переписываем roleMeta.role значением row.role (тип — DB-enum),
 * чтобы избежать конфликта с Role из shared/config/roles.ts.
 */
function toUserWithMeta(row: JoinedUser): UserWithMeta {
  const meta = ROLE_META[row.role as keyof typeof ROLE_META];
  return { ...row, roleMeta: { ...meta, role: row.role } };
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllEpics — лёгкий список для сайдбара и карточек дашборда
// БЫЛО: 2N+1 запросов  →  СТАЛО: 1 запрос
// ─────────────────────────────────────────────────────────────────────────────

async function _getAllEpics(): Promise<(DbEpic & { taskCount: number; doneCount: number })[]> {
  const rows = await db
    .select({
      id:          epics.id,
      title:       epics.title,
      description: epics.description,
      color:       epics.color,
      startDate:   epics.startDate,
      endDate:     epics.endDate,
      createdAt:   epics.createdAt,
      updatedAt:   epics.updatedAt,
      taskCount: count(tasks.id),
      doneCount: sql<number>`
        CAST(COUNT(CASE WHEN ${tasks.status} = 'done' THEN 1 END) AS INTEGER)
      `.mapWith(Number),
    })
    .from(epics)
    .leftJoin(tasks, eq(tasks.epicId, epics.id))
    .groupBy(
      epics.id,
      epics.title,
      epics.description,
      epics.color,
      epics.startDate,
      epics.endDate,
      epics.createdAt,
      epics.updatedAt,
    );

  return rows;
}

export const getAllEpics = cache(
  unstable_cache(_getAllEpics, ["getAllEpics"], {
    revalidate: CACHE_TTL,
    tags: [EPICS_CACHE_TAG],
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// getEpicById — страница одного эпика (не кешируется — нужна свежесть)
// ─────────────────────────────────────────────────────────────────────────────

export const getEpicById = cache(async function getEpicById(
  id: number,
): Promise<EpicWithTasks | null> {
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
    db
      .select({ taskId: taskAssignees.taskId, user: users })
      .from(taskAssignees)
      .innerJoin(users, eq(taskAssignees.userId, users.id))
      .where(inArray(taskAssignees.taskId, taskIds)),
  ]);

  // Map<number, SubtaskView[]> — не any[]
  const subtasksByTask = new Map<number, SubtaskView[]>();
  for (const st of allSubtasks) {
    const arr = subtasksByTask.get(st.taskId) ?? [];
    arr.push(st);
    subtasksByTask.set(st.taskId, arr);
  }

  // Map<number, UserWithMeta[]> — не any[]
  const assigneesByTask = new Map<number, UserWithMeta[]>();
  for (const row of allAssigneeRows) {
    const arr = assigneesByTask.get(row.taskId) ?? [];
    arr.push(toUserWithMeta(row.user));
    assigneesByTask.set(row.taskId, arr);
  }

  const hydratedTasks: TaskView[] = taskRows.map((task) => {
    const taskSubtasks = subtasksByTask.get(task.id) ?? [];
    const assignees    = assigneesByTask.get(task.id) ?? [];
    return {
      ...task,
      assignees,
      subtasks: taskSubtasks,
      progress: {
        done:  taskSubtasks.filter((s) => s.isCompleted).length,
        total: taskSubtasks.length,
      },
    };
  });

  return {
    ...epic,
    tasks: hydratedTasks,
    progress: {
      done:  hydratedTasks.filter((t) => t.status === "done").length,
      total: hydratedTasks.length,
    },
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// getAllEpicsWithTasks — полный граф для Zustand store
// Шаги: (1) эпики → (2) задачи → (3+4 параллельно) подзадачи + исполнители
// ─────────────────────────────────────────────────────────────────────────────

async function _getAllEpicsWithTasks(): Promise<EpicWithTasks[]> {
  const epicRows = await db
    .select({
      id:          epics.id,
      title:       epics.title,
      description: epics.description,
      color:       epics.color,
      startDate:   epics.startDate,
      endDate:     epics.endDate,
      createdAt:   epics.createdAt,
      updatedAt:   epics.updatedAt,
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
    db
      .select({ taskId: taskAssignees.taskId, user: users })
      .from(taskAssignees)
      .innerJoin(users, eq(taskAssignees.userId, users.id))
      .where(inArray(taskAssignees.taskId, taskIds)),
  ]);

  // ── Индексация O(1) — без any ─────────────────────────────────────────────

  const subtasksByTask = new Map<number, SubtaskView[]>();
  for (const st of subtasksRows) {
    const arr = subtasksByTask.get(st.taskId) ?? [];
    arr.push(st);
    subtasksByTask.set(st.taskId, arr);
  }

  const assigneesByTask = new Map<number, UserWithMeta[]>();
  for (const row of assigneeRows) {
    const arr = assigneesByTask.get(row.taskId) ?? [];
    arr.push(toUserWithMeta(row.user));
    assigneesByTask.set(row.taskId, arr);
  }

  type TaskRow = (typeof allTasks)[number];
  const tasksByEpic = new Map<number, TaskRow[]>();
  for (const task of allTasks) {
    const arr = tasksByEpic.get(task.epicId) ?? [];
    arr.push(task);
    tasksByEpic.set(task.epicId, arr);
  }

  // ── Сборка ────────────────────────────────────────────────────────────────

  return epicRows.map((epic) => {
    const epicTasks = tasksByEpic.get(epic.id) ?? [];

    const hydratedTasks: TaskView[] = epicTasks.map((task) => {
      const taskSubtasks = subtasksByTask.get(task.id) ?? [];
      const assignees    = assigneesByTask.get(task.id) ?? [];
      return {
        ...task,
        assignees,
        subtasks: taskSubtasks,
        progress: {
          done:  taskSubtasks.filter((s) => s.isCompleted).length,
          total: taskSubtasks.length,
        },
      };
    });

    return {
      ...epic,
      tasks: hydratedTasks,
      progress: {
        done:  hydratedTasks.filter((t) => t.status === "done").length,
        total: hydratedTasks.length,
      },
    };
  });
}

export const getAllEpicsWithTasks = cache(
  unstable_cache(_getAllEpicsWithTasks, ["getAllEpicsWithTasks"], {
    revalidate: CACHE_TTL,
    tags: [EPICS_CACHE_TAG],
  }),
);