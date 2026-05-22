/**
 * @file route.ts — app/api/roles/[id]
 *
 * ИСПРАВЛЕНИЕ:
 *   БЫЛО: revalidateTag(ROLES_CACHE_TAG, "default")
 *         "default" — несуществующий профиль кеширования в Next.js 16
 *   СТАЛО: revalidateTag(ROLES_CACHE_TAG, "max")
 *         "max" — stale-while-revalidate (рекомендованный профиль)
 *
 * GET    /api/roles/:id
 * PATCH  /api/roles/:id
 * DELETE /api/roles/:id → 409 если есть пользователи
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  getRoleById,
  updateRole,
  deleteRole,
  ROLES_CACHE_TAG,
} from "@/entities/role/roleRepository";
import { USERS_CACHE_TAG } from "@/entities/user/userRepository";
import { z } from "zod";
import { PERSONNEL_COMPOSITION_KEYS } from "@/shared/db/schema";
import { writeAuditLog } from "@/shared/lib/audit";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";

const PatchRoleSchema = z.object({
  label:       z.string().min(1).max(128).optional(),
  short:       z.string().min(1).max(8).optional(),
  hex:         z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().max(512).nullish(),
  composition: z.enum(PERSONNEL_COMPOSITION_KEYS).optional(),
  sortOrder:   z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const role = await getRoleById(Number(id));
  if (!role) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: role });
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const roleId = Number(id);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid role id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = PatchRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 422 });
    }

    const before = await getRoleById(roleId);
    if (!before) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const role = await updateRole(roleId, parsed.data);

    // ✅ ИСПРАВЛЕНО: "max" вместо "default" (несуществующего профиля)
    revalidateTag(ROLES_CACHE_TAG, "max");
    revalidateTag(USERS_CACHE_TAG, "max"); // roleMeta в UserWithMeta обновится
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "update",
      entityType: "role",
      entityId: roleId,
      before,
      after: role,
    });

    return NextResponse.json({ ok: true, data: role });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const roleId = Number(id);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid role id" }, { status: 400 });
    }

    const before = await getRoleById(roleId);
    if (!before) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    await deleteRole(roleId);

    // ✅ ИСПРАВЛЕНО: "max" вместо "default"
    revalidateTag(ROLES_CACHE_TAG, "max");
    revalidateTag(USERS_CACHE_TAG, "max");
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "delete",
      entityType: "role",
      entityId: roleId,
      before,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    const err = e as Error & { code?: string };
    if (err.code === "ROLE_HAS_USERS") {
      return NextResponse.json(
        { ok: false, error: err.message, code: "ROLE_HAS_USERS" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
