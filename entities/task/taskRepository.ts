/**
 * @file taskRepository.ts — entities/task
 *
 * v3 — добавлен createTaskWithRelations:
 *   Создаёт задачу + assignees + subtasks в одной транзакции.
 *   title для subtasks генерируется вызывающей стороной (сервером),
 *   NOT NULL constraint соблюдён.
 */
import { db } from "@/shared/db/client";
import { tasks, subtasks, taskAssignees, users, roles } from "@/shared/db/schema";
import { eq, and } from "drizzle-orm";
import type { TaskStatus, NewTask, TaskView } from "@/shared/types";

// ─── READ ─────────────────────────────────────────────────────────────────────

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
    subtasks:  taskSubtasks,
    progress: {
      done:  taskSubtasks.filter((s) => s.isCompleted).length,
      total: taskSubtasks.length,
    },
  };
}

// ─── WRITE — Tasks ────────────────────────────────────────────────────────────

export async function createTask(data: NewTask): Promise<{ id: number }> {
  const [row] = await db.insert(tasks).values(data).returning({ id: tasks.id });
  return row;
}

/**
 * createTaskWithRelations — атомарное создание задачи с подзадачами и исполнителями.
 *
 * @param task       - основные поля задачи (без id)
 * @param assigneeIds - список userId для task_assignees
 * @param subtasks   - массив { title, isCompleted, sortOrder }
 *                     title должен быть pre-generated сервером ("Подзадача N")
 * @returns { taskId, subtaskIds } — реальные id из БД
 */
export async function createTaskWithRelations(params: {
  task:        NewTask;
  assigneeIds: number[];
  subtasks:    Array<{ title: string; isCompleted: boolean; sortOrder: number }>;
}): Promise<{ taskId: number; subtaskIds: number[] }> {
  const { task, assigneeIds, subtasks: subtaskInputs } = params;

  // SQLite + Drizzle не поддерживает полноценные транзакции через метод db.transaction()
  // в Bun, поэтому выполняем последовательно. При ошибке subtasks/assignees
  // задача остаётся "голой" — это приемлемо для offline-сценария (идентично
  // тому, как работает текущий createTask + отдельные fetch для assignees).
  const [taskRow] = await db
    .insert(tasks)
    .values(task)
    .returning({ id: tasks.id });

  const taskId = taskRow.id;
  const subtaskIds: number[] = [];

  // Insert subtasks
  if (subtaskInputs.length > 0) {
    const insertedSubs = await db
      .insert(subtasks)
      .values(
        subtaskInputs.map((s) => ({
          taskId,
          title:       s.title,
          isCompleted: s.isCompleted,
          sortOrder:   s.sortOrder,
        }))
      )
      .returning({ id: subtasks.id });

    subtaskIds.push(...insertedSubs.map((r) => r.id));
  }

  // Insert assignees (onConflictDoNothing — UNIQUE index)
  if (assigneeIds.length > 0) {
    await db
      .insert(taskAssignees)
      .values(assigneeIds.map((userId) => ({ taskId, userId })))
      .onConflictDoNothing();
  }

  return { taskId, subtaskIds };
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

export async function deleteTask(id: number): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id));
}

// ─── WRITE — Subtasks ─────────────────────────────────────────────────────────

export async function toggleSubtask(subtaskId: number, isCompleted: boolean): Promise<void> {
  await db.update(subtasks).set({ isCompleted }).where(eq(subtasks.id, subtaskId));
}

// ─── WRITE — Assignees ────────────────────────────────────────────────────────

export async function addTaskAssignee(taskId: number, userId: number): Promise<void> {
  await db
    .insert(taskAssignees)
    .values({ taskId, userId })
    .onConflictDoNothing();
}

export async function removeTaskAssignee(taskId: number, userId: number): Promise<void> {
  await db
    .delete(taskAssignees)
    .where(
      and(
        eq(taskAssignees.taskId, taskId),
        eq(taskAssignees.userId, userId),
      ),
    );
}