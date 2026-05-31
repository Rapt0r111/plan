/**
 * @file route.ts — app/api/operative-tasks
 *
 * Permissions:
 *   POST — admins can create for anyone; members can create only for themselves.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOperativeTask } from "@/entities/operative/operativeRepository";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { resolveOperativeCreateUserId } from "@/shared/lib/operative-access";

const CreateSchema = z.object({
  userId: z.number().int().positive().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: Request) {
  try {
    const scope = await requireWorkspaceAccess();


    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const target = resolveOperativeCreateUserId(scope, parsed.data.userId);
    const taskInput = { ...parsed.data, userId: target.userId };

    const assignee = await getUserWithMetaById(target.userId);
    if (!assignee) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    const task = await createOperativeTask(taskInput);

    if (!task) {
      console.error("[operative-tasks POST] createOperativeTask returned undefined");
      return NextResponse.json(
        { ok: false, error: "DB insert returned no row" },
        { status: 500 },
      );
    }

    broadcast("task:created", {
      source: "operative",
      taskId: task.id,
      userId: task.userId,
    });

    // ✅ FIX: writeAuditLog was missing here
    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role }, action: "create",
      entityType: "operative_task",
      entityId: task.id,
      after: task,
      metadata: {
        source: "api",
        mode: target.mode,
        targetUserId: target.userId,
        requestedUserId: parsed.data.userId ?? null,
        changedFields: ["title", "description", "dueDate"].filter((field) => taskInput[field as keyof typeof taskInput] != null),
      },
    });

    return NextResponse.json({ ok: true, data: task }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "OPERATIVE_TASK_SELF_ONLY") {
      return NextResponse.json({ ok: false, error: "Forbidden: operative tasks can be created only for yourself" }, { status: 403 });
    }
    if (e instanceof Error && e.message === "TARGET_USER_REQUIRED") {
      return NextResponse.json({ ok: false, error: "Target user is required" }, { status: 422 });
    }
    const authErr = authErrorToResponse(e);
    if (authErr) {
      return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    }
    console.error("[operative-tasks POST] ERROR:", e);
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 },
    );
  }
}
