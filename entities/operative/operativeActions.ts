"use server";

/**
 * @file operativeActions.ts — entities/operative
 *
 * ИСПРАВЛЕНИЕ v3:
 *   updateOrderAction — ранее обновлял только поле `order`.
 *   Теперь также обновляет `sort_order` для синхронизации обоих полей.
 *   Это устраняет потенциальную путаницу при чтении данных.
 *
 *   Порядок в getAllUsersWithOperativeTasks теперь читается по `order` (v4
 *   operativeRepository), поэтому DnD-порядок задач корректно сохраняется
 *   после перезагрузки страницы.
 */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { adminActionClient, authActionClient } from "@/shared/lib/safe-action";
import { db } from "@/shared/db/client";
import { operativeTasks } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import { createOperativeTask } from "@/entities/operative/operativeRepository";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import { broadcast } from "@/shared/server/eventBus";
import { writeAuditLog } from "@/shared/lib/audit";

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateTaskSchema = z.object({
  userId:      z.number().int().positive().optional(),
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  dueDate:     z.string().datetime().nullable().optional(),
});

const UpdateTaskSchema = z.object({
  id:          z.number().int().positive(),
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  dueDate:     z.string().datetime().nullable().optional(),
  status:      z.enum(["todo", "in_progress", "done"]).optional(),
});

const DeleteTaskSchema = z.object({
  id: z.number().int().positive(),
});

const UpdateOrderSchema = z.object({
  items: z.array(
    z.object({
      id:    z.number().int().positive(),
      order: z.number().int().min(0),
    })
  ).min(1),
});

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * createOperativeTaskAction — admin can create for anyone; members only for themselves
 */
export const createOperativeTaskAction = authActionClient
  .schema(CreateTaskSchema)
  .action(async ({ parsedInput, ctx }) => {
    const profileId = (ctx.user as { profileId?: number | null }).profileId ?? null;
    const targetUserId = ctx.user.role === "admin" ? parsedInput.userId : profileId;

    if (targetUserId == null) {
      throw new Error("Target user is required");
    }
    if (ctx.user.role !== "admin" && parsedInput.userId != null && parsedInput.userId !== targetUserId) {
      throw new Error("Forbidden: operative tasks can be created only for yourself");
    }

    const assignee = await getUserWithMetaById(targetUserId);
    if (!assignee) throw new Error(`User ${targetUserId} not found`);

    const taskInput = { ...parsedInput, userId: targetUserId };
    const task = await createOperativeTask(taskInput);

    revalidatePath("/operative");
    broadcast("task:created", { source: "operative", taskId: task.id });

    await writeAuditLog({
      actor:      { userId: ctx.user.id, role: ctx.user.role },
      action:     "create",
      entityType: "operative_task",
      entityId:   task.id,
      after:      task,
      metadata:   {
        source: "server_action",
        mode: ctx.user.role === "admin" ? "admin_for_user" : "self",
        targetUserId,
        requestedUserId: parsedInput.userId ?? null,
        changedFields: ["title", "description", "dueDate"].filter((field) => taskInput[field as keyof typeof taskInput] != null),
      },
    });

    return { task };
  });

/**
 * updateOperativeTaskAction — статус могут менять все, остальное — только admin
 */
export const updateOperativeTaskAction = authActionClient
  .schema(UpdateTaskSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...patch } = parsedInput;
    const isStatusOnly = Object.keys(patch).every((key) => key === "status");

    if (ctx.user.role !== "admin" && !isStatusOnly) {
      throw new Error("Forbidden: only admins can edit operative task fields other than status");
    }

    const [before] = await db.select().from(operativeTasks).where(eq(operativeTasks.id, id));
    if (!before) throw new Error(`Task ${id} not found`);

    const profileId = (ctx.user as { profileId?: number | null }).profileId ?? null;
    if (ctx.user.role !== "admin" && before.userId !== profileId) {
      throw new Error("Forbidden: operative tasks can be changed only by the owner or admin");
    }

    const [task] = await db
      .update(operativeTasks)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(operativeTasks.id, id))
      .returning();

    if (!task) throw new Error(`Task ${id} not found`);

    revalidatePath("/operative");
    broadcast("task:updated", { source: "operative", taskId: id });

    const action = patch.status && Object.keys(patch).length === 1
      ? "update_status"
      : "update";

    await writeAuditLog({
      actor:      { userId: ctx.user.id, role: ctx.user.role },
      action,
      entityType: "operative_task",
      entityId:   id,
      before,
      after:      task,
      metadata:   {
        source: "server_action",
        targetUserId: before.userId,
        changedFields: Object.keys(patch),
        ...(patch.status !== undefined && { status: { from: before.status, to: patch.status } }),
        ...(patch.dueDate !== undefined && { dueDate: { from: before.dueDate, to: patch.dueDate } }),
      },
    });

    return { task };
  });

/**
 * deleteOperativeTaskAction — только администратор
 */
export const deleteOperativeTaskAction = adminActionClient
  .schema(DeleteTaskSchema)
  .action(async ({ parsedInput, ctx }) => {
    const [before] = await db
      .select()
      .from(operativeTasks)
      .where(eq(operativeTasks.id, parsedInput.id));

    await db
      .delete(operativeTasks)
      .where(eq(operativeTasks.id, parsedInput.id));

    revalidatePath("/operative");
    broadcast("task:deleted", { taskId: parsedInput.id });

    await writeAuditLog({
      actor:      { userId: ctx.user.id, role: ctx.user.role },
      action:     "delete",
      entityType: "operative_task",
      entityId:   parsedInput.id,
      before,
      after:      null,
    });

    return { success: true };
  });

/**
 * updateOrderAction — только администратор.
 *
 * ИСПРАВЛЕНИЕ: теперь обновляет оба поля — `order` и `sort_order`.
 * `order` — используется sortTasks() для клиентской сортировки.
 * `sort_order` — используется в DB-запросе getAllUsersWithOperativeTasks()
 * (теперь по `order`, но синхронизируем оба для консистентности данных).
 *
 * После обновления broadcast через SSE → другие участники видят
 * новый порядок без ручной перезагрузки страницы.
 */
export const updateOrderAction = adminActionClient
  .schema(UpdateOrderSchema)
  .action(async ({ parsedInput, ctx }) => {
    await db.transaction(async (tx) => {
      for (const { id, order } of parsedInput.items) {
        await tx
          .update(operativeTasks)
          .set({
            // ИСПРАВЛЕНО: обновляем оба поля для полной консистентности
            order,
            sortOrder: order,
          })
          .where(eq(operativeTasks.id, id));
      }
    });

    revalidatePath("/operative");

    // Уведомляем всех участников через SSE → автоматический refresh
    broadcast("task:updated", {
      source: "operative",
      type:   "task_reorder",
    });

    await writeAuditLog({
      actor:      { userId: ctx.user.id, role: ctx.user.role },
      action:     "reorder",
      entityType: "operative_task",
      metadata:   { items: parsedInput.items },
    });

    return { success: true };
  });
