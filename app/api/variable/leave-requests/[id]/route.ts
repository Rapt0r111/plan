import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { reviewVariableLeaveRequest, revokeVariableLeaveRequest } from "@/entities/variable/variableRepository";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const ReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "revoked"]),
  comment: z.string().max(2000).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const scope = await requireWorkspaceAccess();
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ ok: false, error: "Invalid request id" }, { status: 400 });
    const parsed = ReviewSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });

    const request = parsed.data.status === "revoked"
      ? await revokeVariableLeaveRequest({ scope, id, comment: parsed.data.comment })
      : await reviewVariableLeaveRequest({ scope, id, ...parsed.data });
    revalidatePath("/variable");
    broadcast("variable:updated", { action: "variable_leave_review", requestId: request.id, status: request.status });
    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: request.status,
      entityType: "variable_leave_request",
      entityId: request.id,
      after: request,
    });
    return NextResponse.json({ ok: true, data: request });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
