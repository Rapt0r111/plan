import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { reorderPersonalPlanUsers } from "@/entities/personal-plan/personalPlanRepository";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const UserOrderSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(2).max(200),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireAdminSession();
    const parsed = UserOrderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const users = await reorderPersonalPlanUsers(parsed.data.userIds);

    revalidatePath("/personal-plan");
    revalidatePath("/operative");
    broadcast("personal_plan:updated", { action: "user_reorder", userIds: parsed.data.userIds });
    broadcast("task:updated", { source: "personal_plan", type: "user_block_reorder", userIds: parsed.data.userIds });

    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "reorder",
      entityType: "personal_plan_user_order",
      metadata: { userIds: parsed.data.userIds },
    });

    return NextResponse.json({ ok: true, data: users });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
