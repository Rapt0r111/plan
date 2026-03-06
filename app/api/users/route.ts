// app/api/users/route.ts
import { NextResponse } from "next/server";
import { getAllUsers } from "@/entities/user/userRepository";

export async function GET() {
  try {
    const data = await getAllUsers();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}