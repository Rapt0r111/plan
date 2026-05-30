import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin } from "better-auth/plugins";
import { db } from "@/shared/db/client";
import * as schema from "@/shared/db/schema";

export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000",

  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.authUsers,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    adminPlugin({
      defaultRole: "member",
      adminRoles: ["admin"],
    }),
  ],

  session: {
    expiresIn: 60 * 60,
    updateAge: 60 * 15,
  },

  user: {
    additionalFields: {
      login: {
        type: "string",
        required: false,
      },
      profileId: {
        type: "number",
        required: false,
        input: false,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "member",
        input: false,
      },
      forcePasswordChange: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
