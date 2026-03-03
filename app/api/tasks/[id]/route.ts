import { NextResponse } from "next/server";
import { updateTask } from "@/entities/task/taskRepository";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    await updateTask(Number(params.id), body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}