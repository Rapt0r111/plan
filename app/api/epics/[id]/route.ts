// app/api/epics/[id]/route.ts — полная версия
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getEpicById, updateEpic, deleteEpic, EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const epic = await getEpicById(Number(id));
    if (!epic) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: epic });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const epic = await updateEpic(Number(id), body);
    revalidateTag(EPICS_CACHE_TAG, "default");
    return NextResponse.json({ ok: true, data: epic });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteEpic(Number(id));
    revalidateTag(EPICS_CACHE_TAG, "default");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}