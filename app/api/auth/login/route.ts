import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/shared/lib/auth";

const LoginSchema = z.object({
  login: z.string().min(3).max(64),
  password: z.string().min(1).max(128),
});

function makeSyntheticEmail(login: string) {
  return `${login.toLowerCase()}@local.plan`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    // ИСПРАВЛЕНИЕ: asResponse: true — получаем полный Response с Set-Cookie заголовками.
    // С asResponse: false Better Auth возвращает только данные, но НЕ передаёт
    // Set-Cookie браузеру, поэтому сессионный cookie никогда не сохранялся.
    const authResponse = await auth.api.signInEmail({
      body: {
        email: makeSyntheticEmail(parsed.data.login.trim()),
        password: parsed.data.password,
      },
      asResponse: true,
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { ok: false, error: "Неверный логин или пароль" },
        { status: 401 }
      );
    }

    const data = await authResponse.json();

    // Создаём ответ и пробрасываем Set-Cookie заголовки от Better Auth браузеру
    const nextResponse = NextResponse.json({ ok: true, data });

    authResponse.headers.forEach((value, name) => {
      if (name.toLowerCase() === "set-cookie") {
        nextResponse.headers.append("set-cookie", value);
      }
    });

    return nextResponse;
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}