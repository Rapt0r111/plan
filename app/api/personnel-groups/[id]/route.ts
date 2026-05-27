import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  deletePersonnelGroup,
  getPersonnelGroupById,
  PERSONNEL_GROUPS_CACHE_TAG,
  updatePersonnelGroup,
} from "@/entities/personnelGroup/personnelGroupRepository";
import { ROLES_CACHE_TAG } from "@/entities/role/roleRepository";
import { USERS_CACHE_TAG } from "@/entities/user/userRepository";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const PatchPersonnelGroupSchema = z.object({
  label: z.string().min(1).max(128).optional(),
  description: z.string().max(512).nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const groupId = Number(id);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid personnel group id" }, { status: 400 });
    }

    const parsed = PatchPersonnelGroupSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const before = await getPersonnelGroupById(groupId);
    if (!before) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const group = await updatePersonnelGroup(groupId, parsed.data);
    revalidateTag(PERSONNEL_GROUPS_CACHE_TAG, "max");
    revalidateTag(ROLES_CACHE_TAG, "max");
    revalidateTag(USERS_CACHE_TAG, "max");
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "update",
      entityType: "personnel_group",
      entityId: groupId,
      before,
      after: group,
    });

    return NextResponse.json({ ok: true, data: group });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const groupId = Number(id);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid personnel group id" }, { status: 400 });
    }

    const before = await getPersonnelGroupById(groupId);
    if (!before) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    await deletePersonnelGroup(groupId);
    revalidateTag(PERSONNEL_GROUPS_CACHE_TAG, "max");
    revalidateTag(ROLES_CACHE_TAG, "max");
    revalidateTag(USERS_CACHE_TAG, "max");
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "delete",
      entityType: "personnel_group",
      entityId: groupId,
      before,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    const err = e as Error & { code?: string };
    if (err.code === "PERSONNEL_GROUP_HAS_ROLES") {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
