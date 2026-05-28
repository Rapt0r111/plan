/**
 * @file route.ts — app/api/tasks/[id]/assignees
 * POST — anyone; DELETE — admin only
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { addTaskAssignee, getTaskById } from "@/entities/task/taskRepository";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { canAccessTask, canAccessUser } from "@/shared/lib/access-scope";
import { writeAuditLog } from "@/shared/lib/audit";

const AddAssigneeSchema = z.object({
  userId: z.number().int().positive(),
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

    const body = await req.json();
    const parsed = AddAssigneeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const [task, assignee] = await Promise.all([
      getTaskById(taskId),
      getUserWithMetaById(parsed.data.userId),
    ]);
    if (!task || !canAccessTask(scope, task) || !assignee || !canAccessUser(scope, assignee)) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    await addTaskAssignee(taskId, parsed.data.userId);
    revalidateTag(EPICS_CACHE_TAG, "max");

    broadcast("task:assignee:added", { taskId, userId: parsed.data.userId });
    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
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
