/**
 * @file route.ts — app/api/operative-tasks/[id]
 *
 * v3 — Audit logging added to PATCH.
 * Admin-only route (existing check preserved).
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  updateOperativeTaskStatus,
  updateOperativeTaskDueDate,
  getOperativeTaskById,
} from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { OPERATIVE_CACHE_TAG } from "../route";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";
import { auditMutation } from "@/shared/lib/auditHelpers";

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
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Forbidden: requires admin role" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body   = await req.json() as unknown;
    const parsed = PatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    // Capture before state for audit
    const beforeTask = await getOperativeTaskById(taskId);

    const { status, dueDate } = parsed.data;
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
      ...(status  !== undefined && { status }),
      ...(dueDate !== undefined && { dueDate }),
    });

    // ── Audit log ──────────────────────────────────────────────────────────
    const action = status !== undefined ? "STATUS_CHANGE" as const : "UPDATE" as const;
    await auditMutation(req, {
      action,
      entityType:  "operative_task",
      entityId:    taskId,
      entityTitle: beforeTask?.title,
      details: {
        before: status !== undefined ? { status: beforeTask?.status } : { dueDate: beforeTask?.dueDate },
        after:  status !== undefined ? { status } : { dueDate },
      },
    });

    return NextResponse.json({ ok: true, data: task });
  } catch (e) {
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden: requires admin role" }, { status: 403 });
    }

    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    // Capture before deletion
    const beforeTask = await getOperativeTaskById(taskId);

    const { db } = await import("@/shared/db/client");
    const { operativeTasks } = await import("@/shared/db/schema");
    const { eq } = await import("drizzle-orm");

    await db.delete(operativeTasks).where(eq(operativeTasks.id, taskId));

    revalidateTag(OPERATIVE_CACHE_TAG, "max");
    broadcast("task:deleted", { taskId, source: "operative" });

    // ── Audit log ──────────────────────────────────────────────────────────
    await auditMutation(req, {
      action:      "DELETE",
      entityType:  "operative_task",
      entityId:    taskId,
      entityTitle: beforeTask?.title,
      details:     { deletedStatus: beforeTask?.status },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}