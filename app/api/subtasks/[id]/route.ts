/**
 * @file route.ts — app/api/subtasks/[id]
 *
 * PATCH  /api/subtasks/:id — переключить isCompleted
 * DELETE /api/subtasks/:id — удалить подзадачу
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { subtasks } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";

const ToggleSubtaskSchema = z.object({
  isCompleted: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const subtaskId = Number(id);

    if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid subtask id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = ToggleSubtaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const [updated] = await db
      .update(subtasks)
      .set({ isCompleted: parsed.data.isCompleted })
      .where(eq(subtasks.id, subtaskId))
      .returning({ id: subtasks.id, taskId: subtasks.taskId });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    revalidateTag(EPICS_CACHE_TAG, "max");
    broadcast("task:subtask:toggled", {
      subtaskId,
      taskId: updated.taskId,
      isCompleted: parsed.data.isCompleted,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const subtaskId = Number(id);

    if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid subtask id" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(subtasks)
      .where(eq(subtasks.id, subtaskId))
      .returning({ id: subtasks.id, taskId: subtasks.taskId });

    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    revalidateTag(EPICS_CACHE_TAG, "max");
    broadcast("task:updated", { taskId: deleted.taskId, subtaskDeleted: subtaskId });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}