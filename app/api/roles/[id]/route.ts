/**
 * @file route.ts — app/api/roles/[id]
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

const PatchRoleSchema = z.object({
  label:       z.string().min(1).max(128).optional(),
  short:       z.string().min(1).max(8).optional(),
  hex:         z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().max(512).nullish(),
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
    const { id } = await params;
    const body = await req.json();
    const parsed = PatchRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const role = await updateRole(Number(id), parsed.data);

    revalidateTag(ROLES_CACHE_TAG, "default");
    revalidateTag(USERS_CACHE_TAG, "default"); // roleMeta в UserWithMeta обновится при ребилде

    return NextResponse.json({ ok: true, data: role });
  } catch (e) {
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteRole(Number(id));

    revalidateTag(ROLES_CACHE_TAG, "default");
    revalidateTag(USERS_CACHE_TAG, "default");

    return NextResponse.json({ ok: true });
  } catch (e) {
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