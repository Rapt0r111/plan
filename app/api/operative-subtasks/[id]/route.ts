/**
 * @file route.ts — app/api/operative-subtasks/[id]
 *
 * Permissions:
 *   PATCH (toggle isCompleted) — anyone (even unauthenticated)
 *   DELETE                     — admin only (added v2)
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { operativeSubtasks } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import { toggleOperativeSubtask } from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, requireAdminSession, optionalSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const ToggleSchema = z.object({
  isCompleted: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await optionalSession();
    const { id }     = await params;
    const subtaskId  = Number(id);

    if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid subtask id" }, { status: 400 });
    }

    const body   = await req.json();
    const parsed = ToggleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const subtask = await toggleOperativeSubtask(subtaskId, parsed.data.isCompleted);
    revalidatePath("/operative");
    broadcast("task:subtask:toggled", {
      source:      "operative",
      subtaskId,
      taskId:      subtask.taskId,
      isCompleted: parsed.data.isCompleted,
    });
    await writeAuditLog({
      actor: session
        ? { userId: session.user.id, role: session.user.role }
        : { userId: null, role: null },
      action: "update_status",
      entityType: "operative_subtask",
      entityId: subtaskId,
      after: { ...subtask, isCompleted: parsed.data.isCompleted },
    });

    return NextResponse.json({ ok: true, data: subtask });
  } catch (e) {
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * DELETE /api/operative-subtasks/:id — admin only.
 * Полностью логируется в audit_logs.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const subtaskId = Number(id);

    if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid subtask id" }, { status: 400 });
    }

    // Снапшот для аудит-лога
    const [subtask] = await db
      .select()
      .from(operativeSubtasks)
      .where(eq(operativeSubtasks.id, subtaskId));

    if (!subtask) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    await db.delete(operativeSubtasks).where(eq(operativeSubtasks.id, subtaskId));

    revalidatePath("/operative");
    broadcast("task:updated", {
      source:         "operative",
      taskId:         subtask.taskId,
      subtaskDeleted: subtaskId,
    });

    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "delete",
      entityType: "operative_subtask",
      entityId: subtaskId,
      before: subtask,
      after: null,
      metadata: { taskId: subtask.taskId, title: subtask.title },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}