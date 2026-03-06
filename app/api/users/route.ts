// app/api/users/route.ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAllUsers, createUser, USERS_CACHE_TAG } from "@/entities/user/userRepository";

export async function GET() {
  try {
    const data = await getAllUsers();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, login, roleId, initials } = body;

    if (!name?.trim()) {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 422 });
    }
    if (!login?.trim()) {
      return NextResponse.json({ ok: false, error: "login is required" }, { status: 422 });
    }
    if (!roleId || typeof roleId !== "number") {
      return NextResponse.json({ ok: false, error: "roleId is required" }, { status: 422 });
    }

    const user = await createUser({ name, login, roleId, initials });
    revalidateTag(USERS_CACHE_TAG, "default");
    return NextResponse.json({ ok: true, data: user }, { status: 201 });
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return NextResponse.json({ ok: false, error: "Login already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}