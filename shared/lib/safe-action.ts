import { createSafeActionClient } from "next-safe-action";
import { headers } from "next/headers";
import { auth } from "./auth";

// ── Базовый клиент — только проверка аутентификации ──────────────────────────
export const authActionClient = createSafeActionClient().use(async ({ next }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized: необходима авторизация");
  }

  return next({ ctx: { user: session.user } });
});

// ── Клиент только для администраторов ────────────────────────────────────────
// Цепочка: authActionClient → дополнительная проверка роли
export const adminActionClient = authActionClient.use(async ({ next, ctx }) => {
  if (ctx.user.role !== "admin") {
    throw new Error("Forbidden: требуются права администратора");
  }

  return next({ ctx });
});

/*
  Архитектурная заметка:
  adminActionClient образует цепочку middleware:
    1. Получаем сессию (authActionClient)
    2. Проверяем role === 'admin' (adminActionClient)
    3. Только затем выполняется сам экшен

  Если любой шаг бросает Error — next-safe-action
  возвращает { serverError: "..." } клиенту.
  Sensitive данные (внутренний стек) не утекают.
*/