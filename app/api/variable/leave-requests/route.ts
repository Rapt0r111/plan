import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { createVariableLeaveRequest } from "@/entities/variable/variableRepository";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { assertVariableSectionAccess } from "@/shared/lib/variable-workflows";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const LeaveRequestSchema = z.object({
  profileUserId: z.number().int().positive(),
  leaveType: z.enum(["day", "daily", "vacation"]),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comment: z.string().max(2000).nullable().optional(),
}).refine((data) => data.dateFrom <= data.dateTo, { message: "dateFrom must be before dateTo", path: ["dateTo"] });

export async function POST(req: Request) {
  try {
    const scope = await requireWorkspaceAccess();
    assertVariableSectionAccess(scope);
    const parsed = LeaveRequestSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });

    const request = await createVariableLeaveRequest({ scope, ...parsed.data });
    revalidatePath("/variable");
    broadcast("variable:updated", { action: "variable_leave_request", requestId: request.id });
    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: "create",
      entityType: "variable_leave_request",
      entityId: request.id,
      after: request,
    });
    return NextResponse.json({ ok: true, data: request }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
