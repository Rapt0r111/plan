import { NextResponse } from "next/server";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";

export async function POST() {
  try {
    await auth.api.signOut({ headers: await headers() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}