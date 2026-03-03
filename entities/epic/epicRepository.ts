/**
 * @file epicRepository.ts - entities/epic
 * All DB queries related to epics.
 * Returns enriched types from shared/types, never raw DB rows.
 */
import { db } from "@/shared/db/client";
import { epics, tasks, taskAssignees, users, subtasks } from "@/shared/db/schema";
import { eq, count, and } from "drizzle-orm";
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

  // Attach task counts in parallel
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

/** Full epic with all tasks, subtasks, and assignees hydrated */
export async function getEpicById(id: number): Promise<EpicWithTasks | null> {
  const [epic] = await db.select().from(epics).where(eq(epics.id, id));
  if (!epic) return null;

  // 1. Get all tasks for this epic
  const taskRows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.epicId, id))
    .orderBy(tasks.sortOrder);

  // 2. Hydrate each task with subtasks + assignees
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
 * getAllEpicsWithTasks — полная гидратация для Board view.
 * Server-side вызов в /board/page.tsx → StoreHydrator → Zustand.
 * Instant DnD без клиентского waterfall.
 */
export async function getAllEpicsWithTasks(): Promise<EpicWithTasks[]> {
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

  const results = await Promise.all(
    epicRows.map((e) => getEpicById(e.id))
  );

  return results.filter((e): e is EpicWithTasks => e !== null);
}