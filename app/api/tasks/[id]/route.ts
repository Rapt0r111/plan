/**
 * @file route.ts — app/api/tasks/[id]
 *
 * v3 — оптимистичный параллелизм:
 *   Клиент добавляет expectedUpdatedAt в тело PATCH.
 *   Сервер обновляет задачу только если tasks.updated_at === expectedUpdatedAt.
 *   Если не совпадает → 409 Conflict с актуальным updatedAt (и задачей целиком).
 *
 * При успехе: обычный ответ { ok: true }.
 * При 409: { ok: false, code: "CONFLICT", currentUpdatedAt, currentTask }.
 *
 * Клиент (replayOfflineQueue) при 409:
 *   1. GET /api/tasks/:id → актуальная задача
 *   2. Применяет свой intended patch поверх неё
 *   3. Повторяет PATCH с новым expectedUpdatedAt
 * Это "rebase поверх актуального" — автоматически принимаем свои изменения.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { tasks } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import { updateTask, deleteTask, getTaskById } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";

const PatchTaskSchema = z.object({
  title:              z.string().min(1).max(200).optional(),
  description:        z.string().max(2000).nullable().optional(),
  status:             z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
  priority:           z.enum(["low", "medium", "high", "critical"]).optional(),
  dueDate:            z.string().datetime().nullable().optional(),
  epicId:             z.number().int().positive().optional(),
  sortOrder:          z.number().int().min(0).optional(),
  // Optimistic concurrency — опциональный для обратной совместимости
  expectedUpdatedAt:  z.string().datetime().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId  = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const task = await getTaskById(taskId);
    if (!task) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, data: task });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId  = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body   = await req.json();
    const parsed = PatchTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { expectedUpdatedAt, ...patch } = parsed.data;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 422 });
    }

    // ── Optimistic concurrency check ───────────────────────────────────────
    if (expectedUpdatedAt) {
      const [current] = await db
        .select({ updatedAt: tasks.updatedAt })
        .from(tasks)
        .where(eq(tasks.id, taskId));

      if (!current) {
        return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
      }

      // Нормализуем формат дат для сравнения (SQLite хранит без 'Z')
      const serverTs = current.updatedAt.replace("Z", "");
      const clientTs = expectedUpdatedAt.replace("Z", "").replace("T", " ").slice(0, 19);
      const serverNorm = serverTs.replace("T", " ").slice(0, 19);

      if (serverNorm !== clientTs) {
        // 409 — задача изменилась другим пользователем
        const currentTask = await getTaskById(taskId);
        return NextResponse.json(
          {
            ok:               false,
            code:             "CONFLICT",
            currentUpdatedAt: current.updatedAt,
            currentTask,
          },
          { status: 409 },
        );
      }
    }

    await updateTask(taskId, patch);
    revalidateTag(EPICS_CACHE_TAG, "max");

    broadcast("task:updated", { taskId, patch });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId  = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    await deleteTask(taskId);
    revalidateTag(EPICS_CACHE_TAG, "max");

    broadcast("task:deleted", { taskId });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}