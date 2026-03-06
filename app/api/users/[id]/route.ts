// app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  getUserById,
  updateUser,
  deleteUser,
  USERS_CACHE_TAG,
} from "@/entities/user/userRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getUserById(Number(id));
    if (!user) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: user });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, login, roleId, initials } = body;

    const patch: Parameters<typeof updateUser>[1] = {};
    if (name !== undefined)     patch.name     = String(name).trim();
    if (login !== undefined)    patch.login    = String(login).trim();
    if (roleId !== undefined)   patch.roleId   = Number(roleId);
    if (initials !== undefined) patch.initials = String(initials).trim().toUpperCase().slice(0, 2);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 422 });
    }

    const user = await updateUser(Number(id), patch);
    revalidateTag(USERS_CACHE_TAG, "default");
    revalidateTag(EPICS_CACHE_TAG, "default"); // assignees в задачах обновятся
    return NextResponse.json({ ok: true, data: user });
  } catch (e) {
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    if (String(e).includes("UNIQUE")) {
      return NextResponse.json({ ok: false, error: "Login already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteUser(Number(id));
    revalidateTag(USERS_CACHE_TAG, "default");
    revalidateTag(EPICS_CACHE_TAG, "default");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}