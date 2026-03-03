/**
 * @file taskRepository.ts - entities/task
 */
import { db } from "@/shared/db/client";
import { tasks, subtasks, taskAssignees, users } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import type { TaskStatus, NewTask, TaskView } from "@/shared/types";
import { ROLE_META } from "@/shared/config/roles";

export async function getTaskById(id: number): Promise<TaskView | null> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return null;

  const taskSubtasks = await db.select().from(subtasks).where(eq(subtasks.taskId, id)).orderBy(subtasks.sortOrder);
  const assigneeRows = await db
    .select({ user: users })
    .from(taskAssignees)
    .innerJoin(users, eq(taskAssignees.userId, users.id))
    .where(eq(taskAssignees.taskId, id));

  return {
    ...task,
    assignees: assigneeRows.map((r) => ({ ...r.user, roleMeta: ROLE_META[r.user.role] })),
    subtasks: taskSubtasks,
    progress: {
      done: taskSubtasks.filter((s) => s.isCompleted).length,
      total: taskSubtasks.length,
    },
  };
}

export async function createTask(data: NewTask): Promise<{ id: number }> {
  const [row] = await db.insert(tasks).values(data).returning({ id: tasks.id });
  return row;
}

export async function updateTaskStatus(id: number, status: TaskStatus): Promise<void> {
  await db
    .update(tasks)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(tasks.id, id));
}

export async function updateTask(id: number, data: Partial<NewTask>): Promise<void> {
  await db
    .update(tasks)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(tasks.id, id));
}

export async function toggleSubtask(subtaskId: number, isCompleted: boolean): Promise<void> {
  await db.update(subtasks).set({ isCompleted }).where(eq(subtasks.id, subtaskId));
}