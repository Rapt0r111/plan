/**
 * @file taskRepository.ts - entities/task
 */
import { db } from "@/shared/db/client";
import { tasks, subtasks, taskAssignees, users, roles } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import type { TaskStatus, NewTask, TaskView } from "@/shared/types";

export async function getTaskById(id: number): Promise<TaskView | null> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return null;

  const taskSubtasks = await db
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, id))
    .orderBy(subtasks.sortOrder);

  const assigneeRows = await db
    .select({
      user: {
        id:        users.id,
        name:      users.name,
        login:     users.login,
        roleId:    users.roleId,
        initials:  users.initials,
        createdAt: users.createdAt,
      },
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
    .from(taskAssignees)
    .innerJoin(users, eq(taskAssignees.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(taskAssignees.taskId, id));

  return {
    ...task,
    assignees: assigneeRows.map((r) => ({ ...r.user, roleMeta: r.role })),
    subtasks: taskSubtasks,
    progress: {
      done:  taskSubtasks.filter((s) => s.isCompleted).length,
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

export async function deleteTask(id: number): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id));
}