import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { updateVariableDailyTask } from "@/entities/variable/variableRepository";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { assertVariableSectionAccess } from "@/shared/lib/variable-workflows";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const UpdateDailyTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["todo", "done"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const scope = await requireWorkspaceAccess();
    assertVariableSectionAccess(scope);
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    const parsed = UpdateDailyTaskSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });

    const task = await updateVariableDailyTask({ scope, id, ...parsed.data });
    revalidatePath("/variable");
    broadcast("variable:updated", { action: "variable_daily_task_update", taskId: task.id });
    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: "update",
      entityType: "variable_daily_task",
      entityId: task.id,
      after: task,
    });
    return NextResponse.json({ ok: true, data: task });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
