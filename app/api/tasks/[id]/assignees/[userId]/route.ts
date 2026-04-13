// app/api/tasks/[id]/assignees/[userId]/route.ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { removeTaskAssignee } from "@/entities/task/taskRepository"; // ← DAL, не db напрямую
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id, userId } = await params;
    const taskId = Number(id);
    const assigneeId = Number(userId);

    await removeTaskAssignee(taskId, assigneeId);
    revalidateTag(EPICS_CACHE_TAG, "max");
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "remove_assignee",
      entityType: "task",
      entityId: taskId,
      metadata: { userId: assigneeId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
