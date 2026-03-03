import { NextResponse } from "next/server";
import { getAllEpics } from "@/entities/epic/epicRepository";

export async function GET() {
  try {
    const data = await getAllEpics();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}