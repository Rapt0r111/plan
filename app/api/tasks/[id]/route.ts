/**
 * @file route.ts — app/api/tasks/[id]
 *
 * Permissions:
 *   GET    — anyone (no auth required)
 *   PATCH  — anyone (no auth required); actor logged as anonymous if unauthenticated
 *   DELETE — admin only
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { tasks } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import { updateTask, deleteTask, getTaskById } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, requireAdminSession, optionalSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const PatchTaskSchema = z.object({
  title:              z.string().min(1).max(200).optional(),
  description:        z.string().max(2000).nullable().optional(),
  status:             z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
  priority:           z.enum(["low", "medium", "high", "critical"]).optional(),
  dueDate:            z.string().datetime().nullable().optional(),
  epicId:             z.number().int().positive().optional(),
  sortOrder:          z.number().int().min(0).optional(),
  expectedUpdatedAt:  z.string().datetime().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId  = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const task = await getTaskById(taskId);
    if (!task) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, data: task });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    // Auth is optional — anyone can update tasks; actor is logged for audit
    const session = await optionalSession();
    const { id } = await params;
    const taskId  = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body   = await req.json();
    const parsed = PatchTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { expectedUpdatedAt, ...patch } = parsed.data;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 422 });
    }

    // Optimistic concurrency check
    if (expectedUpdatedAt) {
      const [current] = await db
        .select({ updatedAt: tasks.updatedAt })
        .from(tasks)
        .where(eq(tasks.id, taskId));

      if (!current) {
        return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
      }

      const serverTs = current.updatedAt.replace("Z", "");
      const clientTs = expectedUpdatedAt.replace("Z", "").replace("T", " ").slice(0, 19);
      const serverNorm = serverTs.replace("T", " ").slice(0, 19);

      if (serverNorm !== clientTs) {
        const currentTask = await getTaskById(taskId);
        return NextResponse.json(
          {
            ok:               false,
            code:             "CONFLICT",
            currentUpdatedAt: current.updatedAt,
            currentTask,
          },
          { status: 409 },
        );
      }
    }

    const before = await getTaskById(taskId);
    await updateTask(taskId, patch);
    const after = await getTaskById(taskId);
    revalidateTag(EPICS_CACHE_TAG, "max");

    broadcast("task:updated", { taskId, patch });
    await writeAuditLog({
      actor: session
        ? { userId: session.user.id, role: session.user.role }
        : { userId: null, role: null },
      action: "update",
      entityType: "task",
      entityId: taskId,
      before,
      after,
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
    const taskId  = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const before = await getTaskById(taskId);
    await deleteTask(taskId);
    revalidateTag(EPICS_CACHE_TAG, "max");

    broadcast("task:deleted", { taskId });
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "delete",
      entityType: "task",
      entityId: taskId,
      before,
      after: null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}