/**
 * @file route.ts — app/api/subtasks/[id]
 *
 * Permissions:
 *   PATCH  — anyone (toggle isCompleted)
 *   DELETE — admin only
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { subtasks } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, requireAdminSession, optionalSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const ToggleSubtaskSchema = z.object({
  isCompleted: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await optionalSession();
    const { id } = await params;
    const subtaskId = Number(id);

    if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid subtask id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = ToggleSubtaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const [updated] = await db
      .update(subtasks)
      .set({ isCompleted: parsed.data.isCompleted })
      .where(eq(subtasks.id, subtaskId))
      .returning({ id: subtasks.id, taskId: subtasks.taskId });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    revalidateTag(EPICS_CACHE_TAG, "max");
    broadcast("task:subtask:toggled", {
      subtaskId,
      taskId: updated.taskId,
      isCompleted: parsed.data.isCompleted,
    });
    await writeAuditLog({
      actor: session
        ? { userId: session.user.id, role: session.user.role }
        : { userId: null, role: null },
      action: "update_status",
      entityType: "subtask",
      entityId: subtaskId,
      after: { ...updated, isCompleted: parsed.data.isCompleted },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const subtaskId = Number(id);

    if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid subtask id" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(subtasks)
      .where(eq(subtasks.id, subtaskId))
      .returning({ id: subtasks.id, taskId: subtasks.taskId });

    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    revalidateTag(EPICS_CACHE_TAG, "max");
    broadcast("task:updated", { taskId: deleted.taskId, subtaskDeleted: subtaskId });
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "delete",
      entityType: "subtask",
      entityId: subtaskId,
      before: deleted,
      after: null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}