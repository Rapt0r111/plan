import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";

const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z
        .string()
        .min(8, "Новый пароль должен содержать не менее 8 символов")
        .max(128),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = ChangePasswordSchema.safeParse(body);

        if (!parsed.success) {
            const message = parsed.error.issues[0]?.message ?? "Проверьте данные";
            return NextResponse.json({ ok: false, error: message }, { status: 422 });
        }

        // Проверяем что пользователь авторизован
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json(
                { ok: false, error: "Необходима авторизация" },
                { status: 401 },
            );
        }

        // Better Auth changePassword — проверяет текущий пароль и обновляет
        // revokeOtherSessions: true — завершает все другие сессии для безопасности
        const authResponse = await auth.api.changePassword({
            body: {
                currentPassword: parsed.data.currentPassword,
                newPassword: parsed.data.newPassword,
                revokeOtherSessions: true,
            },
            headers: await headers(),
            asResponse: true,
        });

        if (!authResponse.ok) {
            const data = await authResponse.json().catch(() => ({})) as { message?: string };
            const raw = data?.message ?? "";
            // Перевод типовых ошибок Better Auth
            let error = "Ошибка смены пароля";
            if (raw.toLowerCase().includes("invalid") || raw.toLowerCase().includes("incorrect")) {
                error = "Неверный текущий пароль";
            } else if (raw.toLowerCase().includes("same")) {
                error = "Новый пароль должен отличаться от текущего";
            } else if (raw) {
                error = raw;
            }
            return NextResponse.json({ ok: false, error }, { status: authResponse.status });
        }

        const nextResponse = NextResponse.json({ ok: true });

        // Пробрасываем Set-Cookie — Better Auth обновляет сессионный cookie
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