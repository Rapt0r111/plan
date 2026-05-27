import { NextResponse } from "next/server";
import { z } from "zod";
import { createTaskComment, getTaskById } from "@/entities/task/taskRepository";
import { createNotification } from "@/entities/management/managementRepository";
import { authErrorToResponse, requireSession } from "@/shared/lib/route-auth";
import { broadcast } from "@/shared/server/eventBus";
import { writeAuditLog } from "@/shared/lib/audit";

type Params = { params: Promise<{ id: string }> };

const CommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireSession();
    const taskId = Number((await params).id);
    const task = await getTaskById(taskId);
    if (!task) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: task.comments ?? [] });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const taskId = Number((await params).id);
    const parsed = CommentSchema.safeParse(await req.json());
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const task = await getTaskById(taskId);
    if (!task) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const comment = await createTaskComment({
      taskId,
      body: parsed.data.body,
      authorUserId: session.user.id,
      authorName: session.user.name,
    });

    await createNotification({
      title: "Новый комментарий",
      body: `${session.user.name}: ${task.title}`,
      kind: "comment",
      entityType: "task",
      entityId: taskId,
      recipientUserId: null,
    });

    broadcast("task:commented", { taskId, commentId: comment.id });
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "comment",
      entityType: "task",
      entityId: taskId,
      after: comment,
    });

    return NextResponse.json({ ok: true, data: comment }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
