import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  createPersonnelGroup,
  getAllPersonnelGroups,
  PERSONNEL_GROUPS_CACHE_TAG,
} from "@/entities/personnelGroup/personnelGroupRepository";
import { ROLES_CACHE_TAG } from "@/entities/role/roleRepository";
import { USERS_CACHE_TAG } from "@/entities/user/userRepository";
import { authErrorToResponse, requireAdminSession, requireSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const CreatePersonnelGroupSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(128),
  description: z.string().max(512).nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8b5cf6"),
  sortOrder: z.number().int().default(99),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireSession();
    const data = await getAllPersonnelGroups({ includeInactive: true });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminSession();
    const parsed = CreatePersonnelGroupSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const group = await createPersonnelGroup({
      ...parsed.data,
      description: parsed.data.description ?? null,
    });
    revalidateTag(PERSONNEL_GROUPS_CACHE_TAG, "max");
    revalidateTag(ROLES_CACHE_TAG, "max");
    revalidateTag(USERS_CACHE_TAG, "max");
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "create",
      entityType: "personnel_group",
      entityId: group.id,
      after: group,
    });

    return NextResponse.json({ ok: true, data: group }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    if (String(e).includes("UNIQUE")) {
      return NextResponse.json({ ok: false, error: "Personnel group key already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
