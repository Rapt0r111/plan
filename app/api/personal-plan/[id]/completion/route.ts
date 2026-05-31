import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  getPersonalPlanItemById,
  setPersonalPlanCompletion,
} from "@/entities/personal-plan/personalPlanRepository";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const CompletionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  completed: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const scope = await requireWorkspaceAccess();
    if (scope.isVariableRestricted) {
      throw new Error("ACCESS_DENIED");
    }
    const itemId = parseId((await params).id);
    if (!itemId) return NextResponse.json({ ok: false, error: "Invalid item id" }, { status: 400 });

    const item = await getPersonalPlanItemById(itemId);
    if (!item) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = CompletionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const completion = await setPersonalPlanCompletion({
      itemId,
      date: parsed.data.date,
      completed: parsed.data.completed,
      completedByUserId: scope.session.user.id,
    });

    revalidatePath("/personal-plan");
    broadcast("personal_plan:updated", {
      action: parsed.data.completed ? "complete" : "uncomplete",
      itemId,
      userId: item.userId,
      date: parsed.data.date,
    });

    await writeAuditLog({
      actor: { userId: scope.session.user.id, role: scope.session.user.role },
      action: parsed.data.completed ? "complete" : "uncomplete",
      entityType: "personal_plan_completion",
      entityId: itemId,
      after: completion,
      metadata: { itemId, date: parsed.data.date, userId: item.userId },
    });

    return NextResponse.json({ ok: true, data: completion });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
