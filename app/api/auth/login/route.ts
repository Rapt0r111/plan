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

    const result = await auth.api.signInEmail({
      body: {
        email: makeSyntheticEmail(parsed.data.login.trim()),
        password: parsed.data.password,
      },
      asResponse: false,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
