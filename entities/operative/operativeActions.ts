"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { adminActionClient, authActionClient } from "@/shared/lib/safe-action";
import { db } from "@/shared/db/client";
import { operativeTasks } from "@/shared/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { broadcast } from "@/shared/server/eventBus";

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
  // Массив { id, order } — новый порядок задач после DnD
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
  .action(async ({ parsedInput }) => {
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
        order:       nextOrder,
      })
      .returning();

    revalidatePath("/operative");
    broadcast("task:created", { source: "operative", taskId: task.id });

    return { task };
  });

/**
 * updateOperativeTaskAction — только администратор
 */
export const updateOperativeTaskAction = adminActionClient
  .schema(UpdateTaskSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...patch } = parsedInput;

    const [task] = await db
      .update(operativeTasks)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(operativeTasks.id, id))
      .returning();

    if (!task) throw new Error(`Task ${id} not found`);

    revalidatePath("/operative");
    broadcast("task:updated", { source: "operative", taskId: id });

    return { task };
  });

/**
 * deleteOperativeTaskAction — только администратор
 */
export const deleteOperativeTaskAction = adminActionClient
  .schema(DeleteTaskSchema)
  .action(async ({ parsedInput }) => {
    await db
      .delete(operativeTasks)
      .where(eq(operativeTasks.id, parsedInput.id));

    revalidatePath("/operative");
    broadcast("task:deleted", { taskId: parsedInput.id });

    return { success: true };
  });

/**
 * updateOrderAction — только администратор
 * Вызывается после DnD — обновляет поле order для всех затронутых задач.
 * Используем atomic batch update.
 */
export const updateOrderAction = adminActionClient
  .schema(UpdateOrderSchema)
  .action(async ({ parsedInput }) => {
    // SQLite не поддерживает batch UPDATE нативно — делаем в транзакции
    await db.transaction(async (tx) => {
      for (const { id, order } of parsedInput.items) {
        await tx
          .update(operativeTasks)
          .set({ order })
          .where(eq(operativeTasks.id, id));
      }
    });

    revalidatePath("/operative");
    return { success: true };
  });