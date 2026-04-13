/**
 * @file route.ts — app/api/roles
 *
 * ИСПРАВЛЕНИЕ:
 *   БЫЛО: revalidateTag(ROLES_CACHE_TAG, "default")
 *         "default" — несуществующий профиль кеширования в Next.js 16
 *   СТАЛО: revalidateTag(ROLES_CACHE_TAG, "max")
 *
 * GET  /api/roles  → список всех ролей
 * POST /api/roles  → создание роли
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAllRoles, createRole, ROLES_CACHE_TAG } from "@/entities/role/roleRepository";
import { z } from "zod";
import { authErrorToResponse, requireSession } from "@/shared/lib/route-auth";

const CreateRoleSchema = z.object({
  key:         z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  label:       z.string().min(1).max(128),
  short:       z.string().min(1).max(8),
  hex:         z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().max(512).nullish(),
  sortOrder:   z.number().int().default(0),
});

export async function GET() {
  try {
    const data = await getAllRoles();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireSession();
    const body = await req.json();
    const parsed = CreateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const role = await createRole(parsed.data);

    // ✅ ИСПРАВЛЕНО: "max" вместо "default" (несуществующего профиля)
    revalidateTag(ROLES_CACHE_TAG, "max");
    // Users кеш не инвалидируем — новая роль без пользователей

    return NextResponse.json({ ok: true, data: role }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    // Unique constraint на key
    if (String(e).includes("UNIQUE")) {
      return NextResponse.json(
        { ok: false, error: "Role key already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
