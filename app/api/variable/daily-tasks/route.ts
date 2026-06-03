import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { createVariableDailyTask } from "@/entities/variable/variableRepository";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { assertVariableSectionAccess } from "@/shared/lib/variable-workflows";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const DailyTaskSchema = z.object({
  profileUserId: z.number().int().positive(),
  taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const scope = await requireWorkspaceAccess();
    assertVariableSectionAccess(scope);
    const parsed = DailyTaskSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });

    const task = await createVariableDailyTask({ scope, ...parsed.data });
    revalidatePath("/variable");
    broadcast("variable:updated", { action: "variable_daily_task", taskId: task.id });
    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: "create",
      entityType: "variable_daily_task",
      entityId: task.id,
      after: task,
    });
    return NextResponse.json({ ok: true, data: task }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
