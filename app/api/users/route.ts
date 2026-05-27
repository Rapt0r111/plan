/**
 * @file route.ts — app/api/users
 *
 * ИСПРАВЛЕНИЕ: серия ручных if-проверок заменена на Zod-схему.
 *   БЫЛО: if (!name?.trim()), if (!login?.trim()), if (typeof roleId !== "number")
 *         Не проверяло: длину строк, диапазон roleId, формат initials.
 *         typeof roleId !== "number" не ловило NaN (typeof NaN === "number").
 *   СТАЛО: CreateUserSchema — полная валидация всех полей.
 *          initials: optional + transform(toUpperCase + slice(0,2)).
 *          roleId: z.number().int().positive() — NaN и 0 → 422.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getAllUsers, createUser, linkAuthUserToProfile, deleteUser, USERS_CACHE_TAG } from "@/entities/user/userRepository";
import { authErrorToResponse, requireAdminSession, requireSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { auth } from "@/shared/lib/auth";

const CreateUserSchema = z.object({
  name:     z.string().min(1).max(200),
  login:    z.string().min(1).max(64),
  password: z.string().min(8).max(128).optional(),
  roleId:   z.number().int().positive(),
  initials: z.string().min(1).max(2)
              .transform((v) => v.toUpperCase())
              .optional(),
});

function makeSyntheticEmail(login: string) {
  return `${login.toLowerCase()}@local.plan`;
}

export async function GET() {
  try {
    await requireSession();
    const data = await getAllUsers();
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
    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const user = await createUser({ ...parsed.data, accountStatus: parsed.data.password ? "active" : "invited" });
    let createdAuthUserId: string | null = null;
    if (parsed.data.password) {
      try {
        const result = await auth.api.signUpEmail({
          body: {
            email: makeSyntheticEmail(parsed.data.login.trim()),
            password: parsed.data.password,
            name: parsed.data.name.trim(),
            login: parsed.data.login.trim(),
          },
          asResponse: false,
        });
        createdAuthUserId = result?.user?.id ?? null;
        if (createdAuthUserId) {
          await linkAuthUserToProfile(user.id, createdAuthUserId);
        }
      } catch (authError) {
        await deleteUser(user.id);
        throw authError;
      }
    }

    const data = createdAuthUserId ? { ...user, authUserId: createdAuthUserId, accountStatus: "active" } : user;
    revalidateTag(USERS_CACHE_TAG, "max");
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "create",
      entityType: "user_profile",
      entityId: user.id,
      after: data,
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    if (String(e).includes("UNIQUE")) {
      return NextResponse.json({ ok: false, error: "Login already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
