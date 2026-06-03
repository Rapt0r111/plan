import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { upsertVariableDutySchedule } from "@/entities/variable/variableRepository";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const DutyScheduleSchema = z.object({
  dutyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slots: z.object({
    day_orderly_1: z.number().int().positive(),
    day_orderly_2: z.number().int().positive(),
    duty_officer: z.number().int().positive(),
  }),
});

export async function PUT(req: Request) {
  try {
    const scope = await requireWorkspaceAccess();
    const parsed = DutyScheduleSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });

    const assignments = await upsertVariableDutySchedule({ scope, ...parsed.data });
    revalidatePath("/variable");
    broadcast("variable:updated", { action: "variable_duty_schedule", dutyDate: parsed.data.dutyDate });
    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: "upsert",
      entityType: "variable_duty_schedule",
      entityId: parsed.data.dutyDate,
      after: assignments,
    });
    return NextResponse.json({ ok: true, data: assignments });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
