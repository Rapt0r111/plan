/**
 * @file route.ts — app/api/tasks/[id]/subtasks
 *
 * POST /api/tasks/:id/subtasks — добавить подзадачу к существующей задаче.
 *
 * sortOrder вычисляется автоматически (max + 1) — клиент не обязан его передавать.
 * Broadcast "task:updated" уведомляет остальных пользователей через SSE.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/shared/db/client";
import { subtasks, tasks } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import { getTaskById } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { canAccessTask } from "@/shared/lib/access-scope";
import { writeAuditLog } from "@/shared/lib/audit";

const CreateSubtaskSchema = z.object({
  title:       z.string().min(1).max(200),
  isCompleted: z.boolean().default(false),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const scope = await requireWorkspaceAccess();
    const session = scope.session;
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    // Verify task exists
    const task = await getTaskById(taskId);
    if (!task || !canAccessTask(scope, task)) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = CreateSubtaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    // Compute next sortOrder
    const existing = await db
      .select({ sortOrder: subtasks.sortOrder })
      .from(subtasks)
      .where(eq(subtasks.taskId, taskId));

    const maxOrder = existing.reduce((m, s) => Math.max(m, s.sortOrder), -1);

    const [subtask] = await db
      .insert(subtasks)
      .values({
        taskId,
        title:       parsed.data.title,
        isCompleted: parsed.data.isCompleted,
        sortOrder:   maxOrder + 1,
      })
      .returning();

    revalidateTag(EPICS_CACHE_TAG, "max");
    broadcast("task:updated", { taskId, subtaskAdded: subtask.id });
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "create",
      entityType: "subtask",
      entityId: subtask.id,
      after: subtask,
    });

    return NextResponse.json({ ok: true, data: subtask }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
