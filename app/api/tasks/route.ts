/**
 * @file route.ts — app/api/tasks
 *
 * Permissions:
 *   POST — anyone (no auth required); actor logged as anonymous if unauthenticated
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createTaskWithRelations } from "@/entities/task/taskRepository";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { canAccessUser } from "@/shared/lib/access-scope";
import { writeAuditLog } from "@/shared/lib/audit";

const SubtaskInputSchema = z.object({
  isCompleted: z.boolean().default(false),
  sortOrder:   z.number().int().min(0).optional(),
});

const CreateTaskSchema = z.object({
  epicId:      z.number().int().positive(),
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  status:      z.enum(["todo", "in_progress", "done", "blocked"]).default("todo"),
  priority:    z.enum(["low", "medium", "high", "critical"]).default("medium"),
  riskStatus:  z.enum(["on_track", "at_risk", "due_today", "overdue", "blocked", "stale", "unassigned", "completed"]).optional(),
  blockedReason: z.string().max(1000).nullable().optional(),
  dueDate:     z.string().datetime().nullable().optional(),
  estimatedHours: z.number().int().min(0).max(10000).nullable().optional(),
  actualHours: z.number().int().min(0).max(10000).nullable().optional(),
  sortOrder:   z.number().int().min(0).default(0),
  assigneeIds: z.array(z.number().int().positive()).optional(),
  subtasks:    z.array(SubtaskInputSchema).optional(),
});

export async function POST(req: Request) {
  try {
    const scope = await requireWorkspaceAccess();
    const body   = await req.json();
    const parsed = CreateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { assigneeIds, subtasks, ...taskData } = parsed.data;
    if (scope.isVariableRestricted) {
      const assignees = await Promise.all((assigneeIds ?? []).map((id) => getUserWithMetaById(id)));
      if (assignees.length === 0 || assignees.some((user) => !user || !canAccessUser(scope, user))) {
        throw new Error("ACCESS_DENIED");
      }
    }

    const result = await createTaskWithRelations({
      task:        taskData,
      assigneeIds: assigneeIds ?? [],
      subtasks:    (subtasks ?? []).map((s, i) => ({
        title:       `Подзадача ${i + 1}`,
        isCompleted: s.isCompleted,
        sortOrder:   s.sortOrder ?? i,
      })),
    });

    revalidateTag(EPICS_CACHE_TAG, "max");

    broadcast("task:created", {
      taskId: result.taskId,
      epicId: parsed.data.epicId,
      title:  parsed.data.title,
    });
    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: "create",
      entityType: "task",
      entityId: result.taskId,
      after: { ...taskData, assigneeIds, subtasks },
    });

    return NextResponse.json(
      { ok: true, data: { id: result.taskId, subtaskIds: result.subtaskIds } },
      { status: 201 },
    );
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
