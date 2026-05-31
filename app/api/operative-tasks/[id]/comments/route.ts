import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOperativeTaskComment, getOperativeTaskById } from "@/entities/operative/operativeRepository";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import { writeAuditLog } from "@/shared/lib/audit";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { canAccessUser } from "@/shared/lib/access-scope";
import { canManageOperativeTask } from "@/shared/lib/operative-access";
import { broadcast } from "@/shared/server/eventBus";

const CreateCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = CreateCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const scope = await requireWorkspaceAccess();
    const task = await getOperativeTaskById(taskId);
    const owner = task ? await getUserWithMetaById(task.userId) : null;
    if (!task || !owner || !canAccessUser(scope, owner)) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    if (!canManageOperativeTask(scope, task)) {
      return NextResponse.json({ ok: false, error: "Forbidden: comments can be added only to your own operative tasks" }, { status: 403 });
    }
    const comment = await createOperativeTaskComment({
      taskId,
      body: parsed.data.body,
      authorUserId: scope.session.user.id,
      authorName: scope.session.user.name,
    });

    revalidatePath("/operative");
    broadcast("task:updated", {
      source: "operative",
      taskId,
      type: "comment_created",
    });

    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: "comment",
      entityType: "operative_task",
      entityId: taskId,
      after: comment,
      metadata: {
        source: "api",
        taskId,
        targetUserId: task.userId,
        changedFields: ["comment"],
      },
    });

    return NextResponse.json({ ok: true, data: comment }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
