import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createPersonalPlanItem } from "@/entities/personal-plan/personalPlanRepository";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const CreatePersonalPlanItemSchema = z.object({
  userId: z.number().int().positive(),
  weekday: z.number().int().min(1).max(7),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  startTime: timeSchema,
  endTime: timeSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().min(0).optional(),
}).refine((data) => data.startTime < data.endTime, {
  message: "startTime must be earlier than endTime",
  path: ["endTime"],
});

export async function POST(req: Request) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();
    const parsed = CreatePersonalPlanItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const item = await createPersonalPlanItem(parsed.data);

    revalidatePath("/personal-plan");
    broadcast("personal_plan:updated", { action: "create", itemId: item.id, userId: item.userId });

    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "create",
      entityType: "personal_plan_item",
      entityId: item.id,
      after: item,
      metadata: { userId: item.userId, weekday: item.weekday },
    });

    return NextResponse.json({ ok: true, data: item }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
