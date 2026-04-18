import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/shared/lib/auth";
import { db } from "@/shared/db/client";
import { authUsers } from "@/shared/db/schema";
import { eq, sql } from "drizzle-orm";

const RegisterSchema = z.object({
  login: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(120).optional(),
});

function makeSyntheticEmail(login: string) {
  return `${login.toLowerCase()}@local.plan`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const login = parsed.data.login.trim();
    const email = makeSyntheticEmail(login);

    // Регистрируем пользователя (asResponse: false — нам не нужны cookies здесь,
    // потому что сразу после этого делаем auto-login с asResponse: true)
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password: parsed.data.password,
        name: parsed.data.name?.trim() || login,
        login,
      },
      asResponse: false,
    });

    // Назначаем права администратора первому пользователю
    const [adminCount] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(authUsers)
      .where(eq(authUsers.role, "admin"));

    if ((adminCount?.count ?? 0) === 0 && result?.user?.id) {
      await db
        .update(authUsers)
        .set({ role: "admin" })
        .where(eq(authUsers.id, result.user.id));
    }

    // ИСПРАВЛЕНИЕ: auto-login с asResponse: true, чтобы Set-Cookie дошёл до браузера.
    // Раньше авторизация на клиенте шла через отдельный fetch к /api/auth/login,
    // и если тот маршрут не пробрасывал cookie — пользователь оставался незалогиненным.
    const loginResponse = await auth.api.signInEmail({
      body: { email, password: parsed.data.password },
      asResponse: true,
    });

    if (!loginResponse.ok) {
      // Регистрация прошла, но auto-login не удался — клиент сам может войти
      return NextResponse.json({ ok: true, data: result, autoLoginFailed: true }, { status: 201 });
    }

    const loginData = await loginResponse.json();
    const nextResponse = NextResponse.json({ ok: true, data: loginData }, { status: 201 });

    // Пробрасываем Set-Cookie браузеру
    loginResponse.headers.forEach((value, name) => {
      if (name.toLowerCase() === "set-cookie") {
        nextResponse.headers.append("set-cookie", value);
      }
    });

    return nextResponse;
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}