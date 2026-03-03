import { NextResponse } from "next/server";
import { toggleSubtask } from "@/entities/task/taskRepository";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { isCompleted } = await req.json();
    await toggleSubtask(Number(params.id), isCompleted);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}