import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/shared/db/client";
import * as schema from "@/shared/db/schema";

export const auth = betterAuth({
  /**
   * baseURL is required by Better Auth for callback URLs and redirects.
   * Set BETTER_AUTH_URL in your environment:
   *   - Local dev:  http://localhost:3000
   *   - Docker:     https://taskflow.local  (or http://192.168.99.101:38701)
   */
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000",

  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user:         schema.authUsers,
      session:      schema.sessions,
      account:      schema.accounts,
      verification: schema.verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
  },

  // Сессия истекает через 1 час.
  // updateAge: скользящее окно — при активности каждые 15 минут
  // сессия (и cookie) автоматически продлевается ещё на expiresIn.
  // Результат: сессия истекает через 1 час НЕАКТИВНОСТИ.
  session: {
    expiresIn: 60 * 60,  // 1 час
    updateAge:  60 * 15, // продлять при каждом запросе, если сессии > 15 мин
  },

  user: {
    // Позволяем читать/записывать доп. поля пользователя
    additionalFields: {
      login: {
        type: "string",
        required: false,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "member",
        input: false, // не принимаем role из регистрации
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User    = typeof auth.$Infer.Session.user;