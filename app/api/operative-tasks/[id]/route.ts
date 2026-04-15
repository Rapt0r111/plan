/**
 * @file route.ts — app/api/operative-tasks/[id]
 *
 * Permissions:
 *   PATCH status — anyone (even unauthenticated)
 *   PATCH dueDate — admin only
 *   DELETE — admin only (handled elsewhere)
 *
 * Operative tasks page has tighter restrictions:
 *   - Status toggle = anyone
 *   - Due date, delete, create = admin only
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  updateOperativeTaskStatus,
  updateOperativeTaskDueDate,
} from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { OPERATIVE_CACHE_TAG } from "../route";
import { authErrorToResponse, requireAdminSession, optionalSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

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
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { status, dueDate } = parsed.data;

    // dueDate changes require admin auth
    if (dueDate !== undefined) {
      try {
        await requireAdminSession();
      } catch (e) {
        const authErr = authErrorToResponse(e);
        if (authErr) {
          return NextResponse.json(
            { ok: false, error: "Forbidden: only admin can change due date" },
            { status: 403 },
          );
        }
      }
    }

    // Status changes are open to everyone (even unauthenticated)
    const session = await optionalSession();

    let task;

    if (status !== undefined) {
      task = await updateOperativeTaskStatus(taskId, status);
    }

    if (dueDate !== undefined) {
      task = await updateOperativeTaskDueDate(taskId, dueDate);
    }

    revalidateTag(OPERATIVE_CACHE_TAG, "max");
    broadcast("task:updated", {
      source: "operative",
      taskId,
      ...(status   !== undefined && { status }),
      ...(dueDate  !== undefined && { dueDate }),
    });
    await writeAuditLog({
      actor: session
        ? { userId: session.user.id, role: session.user.role }
        : { userId: null, role: null },
      action: "update",
      entityType: "operative_task",
      entityId: taskId,
      after: task,
      metadata: { status, dueDate },
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