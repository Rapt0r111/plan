import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  deletePersonalPlanItem,
  getPersonalPlanItemById,
  updatePersonalPlanItem,
} from "@/entities/personal-plan/personalPlanRepository";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const UpdatePersonalPlanItemSchema = z.object({
  userId: z.number().int().positive().optional(),
  weekday: z.number().int().min(1).max(7).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().min(0).optional(),
}).refine((data) => {
  if (data.startTime === undefined || data.endTime === undefined) return true;
  return data.startTime < data.endTime;
}, {
  message: "startTime must be earlier than endTime",
  path: ["endTime"],
});

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ ok: false, error: "Invalid item id" }, { status: 400 });

    const before = await getPersonalPlanItemById(id);
    if (!before) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = UpdatePersonalPlanItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const item = await updatePersonalPlanItem(id, parsed.data);

    revalidatePath("/personal-plan");
    broadcast("personal_plan:updated", { action: "update", itemId: item.id, userId: item.userId });

    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "update",
      entityType: "personal_plan_item",
      entityId: item.id,
      before,
      after: item,
    });

    return NextResponse.json({ ok: true, data: item });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ ok: false, error: "Invalid item id" }, { status: 400 });

    const before = await deletePersonalPlanItem(id);
    if (!before) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    revalidatePath("/personal-plan");
    broadcast("personal_plan:updated", { action: "delete", itemId: id, userId: before.userId });

    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "delete",
      entityType: "personal_plan_item",
      entityId: id,
      before,
      after: null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
