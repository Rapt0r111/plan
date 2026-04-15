/**
 * @file route.ts — app/api/tasks/[id]/assignees
 * POST — anyone; DELETE — admin only
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { addTaskAssignee } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, optionalSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const AddAssigneeSchema = z.object({
  userId: z.number().int().positive(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await optionalSession();
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = AddAssigneeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    await addTaskAssignee(taskId, parsed.data.userId);
    revalidateTag(EPICS_CACHE_TAG, "max");

    broadcast("task:assignee:added", { taskId, userId: parsed.data.userId });
    await writeAuditLog({
      actor: session
        ? { userId: session.user.id, role: session.user.role }
        : { userId: null, role: null },
      action: "add_assignee",
      entityType: "task",
      entityId: taskId,
      metadata: { userId: parsed.data.userId },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}