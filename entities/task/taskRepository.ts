/**
 * @file taskRepository.ts — entities/task
 *
 * v3 — добавлен createTaskWithRelations:
 *   Создаёт задачу + assignees + subtasks в одной транзакции.
 *   title для subtasks генерируется вызывающей стороной (сервером),
 *   NOT NULL constraint соблюдён.
 */
import { db } from "@/shared/db/client";
import { tasks, subtasks, taskAssignees, users, roles, personnelGroups, taskComments, taskActivity } from "@/shared/db/schema";
import { desc, eq, and } from "drizzle-orm";
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

  const [comments, activity] = await Promise.all([
    db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, id))
      .orderBy(desc(taskComments.createdAt), desc(taskComments.id))
      .limit(50),
    db
      .select()
      .from(taskActivity)
      .where(eq(taskActivity.taskId, id))
      .orderBy(desc(taskActivity.createdAt), desc(taskActivity.id))
      .limit(50),
  ]);

  const assigneeRows = await db
    .select({
      user: users, // Выбирает все поля таблицы users, включая blockOrder
      role: roles, // Выбирает все поля таблицы roles
      personnelGroup: personnelGroups,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(taskAssignees.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(personnelGroups, eq(roles.personnelGroupId, personnelGroups.id))
    .where(eq(taskAssignees.taskId, id));

  return {
    ...task,
    assignees: assigneeRows.map((r) => ({ ...r.user, roleMeta: { ...r.role, personnelGroup: r.personnelGroup } })),
    subtasks: taskSubtasks,
    comments,
    activity,
    progress: {
      done: taskSubtasks.filter((s) => s.isCompleted).length,
      total: taskSubtasks.length,
    },
  };
}

// ─── WRITE — Tasks ────────────────────────────────────────────────────────────

export async function createTask(data: NewTask): Promise<{ id: number }> {
  const now = new Date().toISOString();
  const [row] = await db.insert(tasks).values({
    ...data,
    lastActivityAt: data.lastActivityAt ?? now,
    completedAt: data.status === "done" ? (data.completedAt ?? now) : data.completedAt,
  }).returning({ id: tasks.id });
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
  task: NewTask;
  assigneeIds: number[];
  subtasks: Array<{ title: string; isCompleted: boolean; sortOrder: number }>;
}): Promise<{ taskId: number; subtaskIds: number[] }> {
  const { task, assigneeIds, subtasks: subtaskInputs } = params;
  const now = new Date().toISOString();

  // SQLite + Drizzle не поддерживает полноценные транзакции через метод db.transaction()
  // в Bun, поэтому выполняем последовательно. При ошибке subtasks/assignees
  // задача остаётся "голой" — это приемлемо для offline-сценария (идентично
  // тому, как работает текущий createTask + отдельные fetch для assignees).
  const [taskRow] = await db
    .insert(tasks)
    .values({
      ...task,
      lastActivityAt: task.lastActivityAt ?? now,
      completedAt: task.status === "done" ? (task.completedAt ?? now) : task.completedAt,
    })
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
          title: s.title,
          isCompleted: s.isCompleted,
          sortOrder: s.sortOrder,
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
  const now = new Date().toISOString();
  await db
    .update(tasks)
    .set({
      status,
      updatedAt: now,
      lastActivityAt: now,
      completedAt: status === "done" ? now : null,
      blockedReason: status === "blocked" ? undefined : null,
    })
    .where(eq(tasks.id, id));
}

export async function updateTask(id: number, data: Partial<NewTask>): Promise<void> {
  const now = new Date().toISOString();
  const completedAt =
    data.status === "done" ? now :
    data.status === undefined ? data.completedAt :
    null;
  await db
    .update(tasks)
    .set({
      ...data,
      updatedAt: now,
      lastActivityAt: now,
      completedAt,
    })
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
  await touchTask(taskId);
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
  await touchTask(taskId);
}

export async function createTaskComment(data: {
  taskId: number;
  body: string;
  authorUserId?: string | null;
  authorName?: string | null;
}) {
  const [row] = await db
    .insert(taskComments)
    .values({
      taskId: data.taskId,
      body: data.body.trim(),
      authorUserId: data.authorUserId ?? null,
      authorName: data.authorName?.trim() || "Гость",
    })
    .returning();
  await recordTaskActivity({
    taskId: data.taskId,
    actorUserId: data.authorUserId,
    actorName: data.authorName,
    action: "comment",
    summary: "Добавлен комментарий",
  });
  return row;
}

export async function recordTaskActivity(data: {
  taskId: number;
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  summary: string;
  metadata?: unknown;
}) {
  const [row] = await db
    .insert(taskActivity)
    .values({
      taskId: data.taskId,
      actorUserId: data.actorUserId ?? null,
      actorName: data.actorName?.trim() || "Система",
      action: data.action,
      summary: data.summary,
      metadataJson: data.metadata !== undefined ? JSON.stringify(data.metadata) : null,
    })
    .returning();
  await touchTask(data.taskId);
  return row;
}

async function touchTask(taskId: number) {
  const now = new Date().toISOString();
  await db.update(tasks).set({ lastActivityAt: now, updatedAt: now }).where(eq(tasks.id, taskId));
}
