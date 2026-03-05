/**
 * @file epicRepository.ts — entities/epic
 *
 * ═══════════════════════════════════════════════════════════════
 * PERFORMANCE AUDIT — v3
 * ═══════════════════════════════════════════════════════════════
 *
 * ИЗМЕНЕНИЯ v3:
 *
 * 1. TTL увеличен с 30s до 60s для getAllEpicsWithTasks.
 *    Rationale: мутации всегда инвалидируют кеш через revalidateTag,
 *    значит 30s → 60s не ухудшает свежесть данных, но снижает нагрузку.
 *
 * 2. CACHE_TTL_LIGHT = 120s для getAllEpics (лёгкий запрос для сайдбара/дашборда).
 *    Счётчики задач менее критичны к мгновенной свежести.
 *
 * 3. Явная пометка unstable_cache ключей — разные ключи для разных функций,
 *    чтобы revalidateTag("epics") сбрасывал ОБА кеша одновременно.
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/shared/db/client";
import { epics, tasks, taskAssignees, users, subtasks } from "@/shared/db/schema";
import { eq, inArray, sql, count } from "drizzle-orm";
import type { DbEpic, EpicWithTasks, TaskView, UserWithMeta, SubtaskView } from "@/shared/types";
import { ROLE_META } from "@/shared/config/roles";

export const EPICS_CACHE_TAG = "epics";

/** TTL для тяжёлого запроса (полный граф задач) */
const CACHE_TTL = 60;

/** TTL для лёгкого запроса (только счётчики) */
const CACHE_TTL_LIGHT = 120;

// ─── Вспомогательный тип для JOIN-строки ─────────────────────────────────────
type JoinedUser = typeof users.$inferSelect;

function toUserWithMeta(row: JoinedUser): UserWithMeta {
  const meta = ROLE_META[row.role as keyof typeof ROLE_META];
  // Fallback для роли, не найденной в ROLE_META (защита от рассинхрона schema/config)
  if (!meta) {
    return {
      ...row,
      roleMeta: {
        role: row.role as never,
        label: row.role,
        short: row.role.slice(0, 3).toUpperCase(),
        bgClass: "bg-slate-500/10",
        textClass: "text-slate-400",
        borderClass: "border-slate-500/20",
        hex: "#94a3b8",
      },
    };
  }
  return { ...row, roleMeta: { ...meta, role: row.role } };
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllEpics — лёгкий список для сайдбара и карточек дашборда
// 1 SQL-запрос (LEFT JOIN + GROUP BY + CASE WHEN)
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
    revalidate: CACHE_TTL_LIGHT,
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

  const subtasksByTask = new Map<number, SubtaskView[]>();
  for (const st of allSubtasks) {
    const arr = subtasksByTask.get(st.taskId) ?? [];
    arr.push(st);
    subtasksByTask.set(st.taskId, arr);
  }

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
// 3 SQL-запроса (epics → tasks → [subtasks + assignees] параллельно)
// Используется только там, где нужен полный граф:
//   - /board (BoardPage)
//   - HeavyWidgets на /dashboard (внутри <Suspense>)
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