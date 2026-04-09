/**
 * @file route.ts — app/api/operative-tasks/[id]
 *
 * ОБНОВЛЕНИЕ v2 — Дедлайн:
 *   Расширен PatchSchema — теперь поддерживает `dueDate` в дополнение к `status`.
 *   Оба поля опциональны, достаточно передать хотя бы одно.
 *
 * PATCH /api/operative-tasks/:id — изменить статус и/или дедлайн задачи.
 * DELETE намеренно отсутствует.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  updateOperativeTaskStatus,
  updateOperativeTaskDueDate,
} from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { OPERATIVE_CACHE_TAG } from "../route";

const PatchSchema = z.object({
  status:  z.enum(["todo", "in_progress", "done"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
}).refine(
  (data) => data.status !== undefined || data.dueDate !== undefined,
  { message: "At least one of status or dueDate must be provided" }
);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body   = await req.json();
    const parsed = PatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { status, dueDate } = parsed.data;
    let task;

    // Apply status update if provided
    if (status !== undefined) {
      task = await updateOperativeTaskStatus(taskId, status);
    }

    // Apply dueDate update if provided
    if (dueDate !== undefined) {
      task = await updateOperativeTaskDueDate(taskId, dueDate);
    }

    revalidateTag(OPERATIVE_CACHE_TAG, "max");
    broadcast("task:updated", {
      source: "operative",
      taskId,
      ...(status   !== undefined && { status }),
      ...(dueDate  !== undefined && { dueDate }),
    });

    return NextResponse.json({ ok: true, data: task });
  } catch (e) {
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}