/**
 * @file route.ts — app/api/operative-tasks/[id]/subtasks
 *
 * POST /api/operative-tasks/:id/subtasks — добавить подзадачу.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createOperativeSubtask,
  getOperativeTaskById,
} from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { canManageOperativeTask } from "@/shared/lib/operative-access";

const CreateSubtaskSchema = z.object({
  title: z.string().min(1).max(200),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const scope = await requireWorkspaceAccess();
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const task = await getOperativeTaskById(taskId);
    if (!task) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }
    if (!canManageOperativeTask(scope, task)) {
      return NextResponse.json({ ok: false, error: "Forbidden: subtasks can be added only to your own operative tasks" }, { status: 403 });
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
    broadcast("task:updated", { source: "operative", taskId, subtaskAdded: subtask.id });

    // ✅ FIX: writeAuditLog was missing here
    await writeAuditLog({
      actor:      { userId: scope.session.user.id, role: scope.session.user.role },
      action:     "create_subtask",
      entityType: "operative_subtask",
      entityId:   subtask.id,
      after:      subtask,
      metadata:   {
        source: "api",
        taskId,
        targetUserId: task.userId,
        taskTitle: task.title,
        changedFields: ["title"],
      },
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
