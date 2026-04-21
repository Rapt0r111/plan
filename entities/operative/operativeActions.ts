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
import { eq, sql } from "drizzle-orm";
import { broadcast } from "@/shared/server/eventBus";
import { writeAuditLog } from "@/shared/lib/audit";

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateTaskSchema = z.object({
  userId:      z.number().int().positive(),
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
 * createOperativeTaskAction — только администратор
 */
export const createOperativeTaskAction = adminActionClient
  .schema(CreateTaskSchema)
  .action(async ({ parsedInput, ctx }) => {
    const maxOrderRow = await db
      .select({ maxOrder: sql<number>`MAX("order")` })
      .from(operativeTasks)
      .where(eq(operativeTasks.userId, parsedInput.userId));

    const nextOrder = (maxOrderRow[0]?.maxOrder ?? -1) + 1;

    const [task] = await db
      .insert(operativeTasks)
      .values({
        userId:      parsedInput.userId,
        title:       parsedInput.title,
        description: parsedInput.description ?? null,
        dueDate:     parsedInput.dueDate ?? null,
        // Обновляем оба поля для консистентности
        sortOrder:   nextOrder,
        order:       nextOrder,
      })
      .returning();

    revalidatePath("/operative");
    broadcast("task:created", { source: "operative", taskId: task.id });

    await writeAuditLog({
      actor:      { userId: ctx.user.id, role: ctx.user.role },
      action:     "create",
      entityType: "operative_task",
      entityId:   task.id,
      after:      task,
      metadata:   { userId: parsedInput.userId },
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