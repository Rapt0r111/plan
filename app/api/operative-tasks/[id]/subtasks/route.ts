/**
 * @file route.ts — app/api/operative-tasks/[id]/subtasks
 *
 * POST /api/operative-tasks/:id/subtasks — добавить подзадачу.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  createOperativeSubtask,
  getOperativeTaskById,
} from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { OPERATIVE_CACHE_TAG } from "../../route";

const CreateSubtaskSchema = z.object({
  title: z.string().min(1).max(200),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    // Verify task exists
    const task = await getOperativeTaskById(taskId);
    if (!task) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    const body   = await req.json();
    const parsed = CreateSubtaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const subtask = await createOperativeSubtask({ taskId, title: parsed.data.title });
    revalidateTag(OPERATIVE_CACHE_TAG, "max");
    broadcast("task:updated", { source: "operative", taskId, subtaskAdded: subtask.id });

    return NextResponse.json({ ok: true, data: subtask }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}