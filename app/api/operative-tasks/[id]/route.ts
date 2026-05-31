/**
 * @file route.ts — app/api/operative-tasks/[id]
 *
 * Permissions:
 *   PATCH status  — admins for anyone; members only for their own tasks
 *   PATCH dueDate — admin only
 *   DELETE        — admin only (added v2)
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { operativeTasks } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import {
  getOperativeTaskById,
  updateOperativeTaskStatus,
  updateOperativeTaskDueDate,
} from "@/entities/operative/operativeRepository";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, requireAdminSession, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { canAccessUser } from "@/shared/lib/access-scope";
import { writeAuditLog } from "@/shared/lib/audit";
import { canManageOperativeTask } from "@/shared/lib/operative-access";

const PatchSchema = z.object({
  status:  z.enum(["todo", "in_progress", "done"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
}).refine(
  (data) => data.status !== undefined || data.dueDate !== undefined,
  { message: "At least one of status or dueDate must be provided" }
);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body   = await req.json();
    const parsed = PatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const { status, dueDate } = parsed.data;

    // dueDate changes require admin
    if (dueDate !== undefined) {
      try {
        await requireAdminSession();
      } catch {
        return NextResponse.json(
          { ok: false, error: "Forbidden: only admin can change due date" },
          { status: 403 },
        );
      }
    }

    const scope = await requireWorkspaceAccess();
    const current = await getOperativeTaskById(taskId);
    const owner = current ? await getUserWithMetaById(current.userId) : null;
    if (!current || !owner || !canAccessUser(scope, owner)) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    if (!canManageOperativeTask(scope, current)) {
      return NextResponse.json({ ok: false, error: "Forbidden: operative tasks can be changed only by the owner or admin" }, { status: 403 });
    }
    let task;

    if (status !== undefined) {
      task = await updateOperativeTaskStatus(taskId, status);
    }

    if (dueDate !== undefined) {
      task = await updateOperativeTaskDueDate(taskId, dueDate);
    }

    revalidatePath("/operative");
    broadcast("task:updated", {
      source: "operative",
      taskId,
      ...(status  !== undefined && { status }),
      ...(dueDate !== undefined && { dueDate }),
    });
    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: status !== undefined && dueDate === undefined
        ? "update_status"
        : dueDate !== undefined && status === undefined
          ? "update_due_date"
          : "update",
      entityType: "operative_task",
      entityId: taskId,
      before: current,
      after: task,
      metadata: {
        source: "api",
        targetUserId: current.userId,
        changedFields: [
          ...(status !== undefined ? ["status"] : []),
          ...(dueDate !== undefined ? ["dueDate"] : []),
        ],
        status: status !== undefined ? { from: current.status, to: status } : undefined,
        dueDate: dueDate !== undefined ? { from: current.dueDate, to: dueDate } : undefined,
      },
    });

    return NextResponse.json({ ok: true, data: task });
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
 * DELETE /api/operative-tasks/:id — admin only.
 * Каскадно удаляет все подзадачи (FK ON DELETE CASCADE в схеме).
 * Полностью логируется в audit_logs.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    // Снапшот перед удалением для аудит-лога
    const [task] = await db
      .select()
      .from(operativeTasks)
      .where(eq(operativeTasks.id, taskId));

    if (!task) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // Удаляем — подзадачи каскадно удалятся по FK
    await db.delete(operativeTasks).where(eq(operativeTasks.id, taskId));

    revalidatePath("/operative");
    broadcast("task:deleted", { source: "operative", taskId, userId: task.userId });

    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "delete",
      entityType: "operative_task",
      entityId: taskId,
      before: task,
      after: null,
      metadata: { userId: task.userId, title: task.title },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
