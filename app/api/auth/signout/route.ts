import { NextResponse } from "next/server";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";

export async function POST() {
  try {
    // ИСПРАВЛЕНИЕ: asResponse: true — получаем Set-Cookie заголовки с expires в прошлом,
    // которые удаляют сессионный cookie браузера. Без этого cookie не очищался.
    const authResponse = await auth.api.signOut({
      headers: await headers(),
      asResponse: true,
    });

    const nextResponse = NextResponse.json({ ok: true });

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