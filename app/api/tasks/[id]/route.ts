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
import { auditMutation } from "@/shared/lib/auditHelpers";

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

    // Capture before-state for audit
    const beforeTask = await getTaskById(taskId);

    await updateTask(taskId, patch);
    revalidateTag(EPICS_CACHE_TAG, "max");
    broadcast("task:updated", { taskId, patch });

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
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId  = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    // Capture before deletion for audit
    const task = await getTaskById(taskId);

    await deleteTask(taskId);
    revalidateTag(EPICS_CACHE_TAG, "max");
    broadcast("task:deleted", { taskId });

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
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}