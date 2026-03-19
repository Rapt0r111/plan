/**
 * @file route.ts — app/api/users/[id]
 *
 * ИСПРАВЛЕНИЕ: ручная деструктуризация + String(x).trim() заменена на Zod.
 *   БЫЛО: const { name, login, roleId, initials } = body
 *         patch строился вручную — не было проверки длин, форматов, типов.
 *         roleId: Number(roleId) молча превращал "abc" в NaN.
 *   СТАЛО: PatchUserSchema — строгая типизация каждого поля.
 *          roleId: z.number().int().positive() — NaN, строки, 0 → 422.
 *          initials: max(2) + toUpperCase() в transform.
 *          name/login: min(1) чтобы не сохранять пустые строки.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  getUserById,
  updateUser,
  deleteUser,
  USERS_CACHE_TAG,
} from "@/entities/user/userRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

const PatchUserSchema = z.object({
  name:     z.string().min(1).max(200).optional(),
  login:    z.string().min(1).max(64).optional(),
  roleId:   z.number().int().positive().optional(),
  initials: z.string().min(1).max(2).transform((v) => v.toUpperCase()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, data: user });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = PatchUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 422 });
    }

    const user = await updateUser(userId, parsed.data);
    revalidateTag(USERS_CACHE_TAG, "max");
    revalidateTag(EPICS_CACHE_TAG, "max"); // assignees в задачах обновятся

    return NextResponse.json({ ok: true, data: user });
  } catch (e) {
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    if (String(e).includes("UNIQUE")) {
      return NextResponse.json({ ok: false, error: "Login already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });
    }

    await deleteUser(userId);
    revalidateTag(USERS_CACHE_TAG, "max");
    revalidateTag(EPICS_CACHE_TAG, "max");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}