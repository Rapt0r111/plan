import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { upsertVariableDutySchedule, upsertVariableWorkGroupSchedule } from "@/entities/variable/variableRepository";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const DutyScheduleSchema = z.object({
  scheduleType: z.enum(["daily", "work_group"]).default("daily"),
  dutyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slots: z.object({
    day_orderly_1: z.number().int().positive().optional(),
    day_orderly_2: z.number().int().positive().optional(),
    duty_officer: z.number().int().positive().optional(),
    day_rg: z.number().int().positive().optional(),
    night_rg: z.number().int().positive().optional(),
    info_rg: z.number().int().positive().optional(),
  }),
}).superRefine((data, ctx) => {
  if (data.scheduleType === "daily" && !data.dutyDate) {
    ctx.addIssue({ code: "custom", message: "dutyDate is required", path: ["dutyDate"] });
  }
  if (data.scheduleType === "work_group") {
    if (!data.dateFrom) ctx.addIssue({ code: "custom", message: "dateFrom is required", path: ["dateFrom"] });
    if (!data.dateTo) ctx.addIssue({ code: "custom", message: "dateTo is required", path: ["dateTo"] });
    if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
      ctx.addIssue({ code: "custom", message: "dateFrom must be before dateTo", path: ["dateTo"] });
    }
  }
});

export async function PUT(req: Request) {
  try {
    const scope = await requireWorkspaceAccess();
    const parsed = DutyScheduleSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });

    const assignments = parsed.data.scheduleType === "work_group"
      ? await upsertVariableWorkGroupSchedule({
        scope,
        dateFrom: parsed.data.dateFrom!,
        dateTo: parsed.data.dateTo!,
        slots: parsed.data.slots,
      })
      : await upsertVariableDutySchedule({
        scope,
        dutyDate: parsed.data.dutyDate!,
        slots: parsed.data.slots,
      });
    revalidatePath("/variable");
    broadcast("variable:updated", { action: "variable_duty_schedule", dutyDate: parsed.data.dutyDate ?? parsed.data.dateFrom });
    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: "upsert",
      entityType: "variable_duty_schedule",
      entityId: parsed.data.dutyDate ?? parsed.data.dateFrom,
      after: assignments,
    });
    return NextResponse.json({ ok: true, data: assignments });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
