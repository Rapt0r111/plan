/**
 * @file route.ts — app/api/operative-subtasks/[id]
 *
 * PATCH /api/operative-subtasks/:id — переключить isCompleted.
 * DELETE намеренно отсутствует.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { toggleOperativeSubtask } from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { OPERATIVE_CACHE_TAG } from "../../operative-tasks/route";

const ToggleSchema = z.object({
  isCompleted: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id }     = await params;
    const subtaskId  = Number(id);

    if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid subtask id" }, { status: 400 });
    }

    const body   = await req.json();
    const parsed = ToggleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const subtask = await toggleOperativeSubtask(subtaskId, parsed.data.isCompleted);
    revalidateTag(OPERATIVE_CACHE_TAG, "max");
    broadcast("task:subtask:toggled", {
      source:      "operative",
      subtaskId,
      taskId:      subtask.taskId,
      isCompleted: parsed.data.isCompleted,
    });

    return NextResponse.json({ ok: true, data: subtask });
  } catch (e) {
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}