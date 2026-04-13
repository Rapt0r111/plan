import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/shared/db/client";
import * as schema from "@/shared/db/schema";

export const auth = betterAuth({
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

  // Расширяем сессию — добавляем role в токен
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 дней
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
