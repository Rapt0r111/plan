/**
 * @file route.ts — app/api/tasks/[id]
 *
 * v4 — Audit logging added to PATCH and DELETE.
 * All mutations now produce an audit record with before/after state.
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
import { authErrorToResponse, requireAdminSession, requireSession } from "@/shared/lib/route-auth";
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
    const session = await requireSession();
    const { id } = await params;
    const taskId  = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body   = await req.json() as unknown;
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

    // ── Optimistic concurrency check ───────────────────────────────────────
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
      actor: { userId: session.user.id, role: session.user.role },
      action: "update",
      entityType: "task",
      entityId: taskId,
      before,
      after,
    });

    // ── Audit log ──────────────────────────────────────────────────────────
    const action = patch.status && patch.status !== beforeTask?.status
      ? "STATUS_CHANGE" as const
      : "UPDATE" as const;

    await auditMutation(req, {
      action,
      entityType:  "task",
      entityId:    taskId,
      entityTitle: beforeTask?.title,
      details: {
        before: patch.status ? { status: beforeTask?.status } : undefined,
        patch: Object.fromEntries(
          Object.entries(patch).filter(([k]) => k !== "sortOrder")
        ),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
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

    // ── Audit log ──────────────────────────────────────────────────────────
    await auditMutation(req, {
      action:      "DELETE",
      entityType:  "task",
      entityId:    taskId,
      entityTitle: task?.title,
      details:     { deletedStatus: task?.status, deletedPriority: task?.priority },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
