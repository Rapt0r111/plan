import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOperativeTaskComment } from "@/entities/operative/operativeRepository";
import { writeAuditLog } from "@/shared/lib/audit";
import { authErrorToResponse, optionalSession } from "@/shared/lib/route-auth";
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

    const session = await optionalSession();
    const comment = await createOperativeTaskComment({
      taskId,
      body: parsed.data.body,
      authorUserId: session?.user.id ?? null,
      authorName: session?.user.name ?? "Гость",
    });

    revalidatePath("/operative");
    broadcast("task:updated", {
      source: "operative",
      taskId,
      type: "comment_created",
    });

    await writeAuditLog({
      actor: session
        ? { userId: session.user.id, role: session.user.role }
        : { userId: null, role: null },
      action: "comment",
      entityType: "operative_task",
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
