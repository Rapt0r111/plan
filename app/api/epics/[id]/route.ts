import { NextResponse } from "next/server";
import { getEpicById } from "@/entities/epic/epicRepository";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const epic = await getEpicById(Number(params.id));
    if (!epic) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: epic });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}