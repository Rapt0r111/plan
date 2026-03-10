// app/api/epics/route.ts — полная версия
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAllEpics, createEpic, EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

export async function GET() {
  try {
    const data = await getAllEpics();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.title) {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 422 });
    }
    const epic = await createEpic(body);
    revalidateTag(EPICS_CACHE_TAG, "max");
    return NextResponse.json({ ok: true, data: epic }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}