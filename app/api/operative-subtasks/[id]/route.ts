/**
 * @file route.ts — app/api/operative-subtasks/[id]
 *
 * Permissions:
 *   PATCH (toggle isCompleted) — admins for anyone; members only for their own tasks
 *   DELETE                     — admin only (added v2)
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { operativeSubtasks, operativeTasks } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import { toggleOperativeSubtask } from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, requireAdminSession, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { canAccessUser } from "@/shared/lib/access-scope";
import { writeAuditLog } from "@/shared/lib/audit";
import { canManageOperativeUser } from "@/shared/lib/operative-access";

const ToggleSchema = z.object({
  isCompleted: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const scope = await requireWorkspaceAccess();
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

    const [ownerRow] = await db
      .select({
        userId: operativeTasks.userId,
        taskId: operativeTasks.id,
        subtaskTitle: operativeSubtasks.title,
        isCompleted: operativeSubtasks.isCompleted,
      })
      .from(operativeSubtasks)
      .innerJoin(operativeTasks, eq(operativeSubtasks.taskId, operativeTasks.id))
      .where(eq(operativeSubtasks.id, subtaskId));
    const owner = ownerRow ? await getUserWithMetaById(ownerRow.userId) : null;
    if (!ownerRow || !owner || !canAccessUser(scope, owner)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    if (!canManageOperativeUser(scope, ownerRow.userId)) {
      return NextResponse.json({ ok: false, error: "Forbidden: subtasks can be changed only by the owner or admin" }, { status: 403 });
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
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: "toggle_subtask",
      entityType: "operative_subtask",
      entityId: subtaskId,
      before: { id: subtaskId, taskId: ownerRow.taskId, title: ownerRow.subtaskTitle, isCompleted: ownerRow.isCompleted },
      after: { ...subtask, isCompleted: parsed.data.isCompleted },
      metadata: {
        source: "api",
        taskId: subtask.taskId,
        targetUserId: ownerRow.userId,
        changedFields: ["isCompleted"],
        isCompleted: { from: ownerRow.isCompleted, to: parsed.data.isCompleted },
      },
    });

    return NextResponse.json({ ok: true, data: subtask });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
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
