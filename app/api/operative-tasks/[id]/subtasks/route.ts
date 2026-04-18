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
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const CreateSubtaskSchema = z.object({
  title: z.string().min(1).max(200),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

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

    // ✅ FIX: writeAuditLog was missing here
    await writeAuditLog({
      actor:      { userId: session.user.id, role: session.user.role },
      action:     "create",
      entityType: "operative_subtask",
      entityId:   subtask.id,
      after:      subtask,
      metadata:   { taskId, taskTitle: task.title },
    });

    return NextResponse.json({ ok: true, data: subtask }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) {
      return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}