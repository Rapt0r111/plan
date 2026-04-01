/**
 * @file route.ts — app/api/subtasks/[id]
 *
 * РЕФАКТОРИНГ v2 — Real-time broadcast при переключении подзадачи.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { toggleSubtask } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";

const ToggleSubtaskSchema = z.object({
  isCompleted: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    await toggleSubtask(subtaskId, parsed.data.isCompleted);
    revalidateTag(EPICS_CACHE_TAG, "max");

    broadcast("task:subtask:toggled", {
      subtaskId,
      isCompleted: parsed.data.isCompleted,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}