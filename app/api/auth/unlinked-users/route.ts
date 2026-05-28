import { NextResponse } from "next/server";
import { getUnlinkedAuthUsers } from "@/entities/user/userRepository";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";

export async function GET() {
  try {
    await requireAdminSession();
    const data = await getUnlinkedAuthUsers();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message, code: authErr.code }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
