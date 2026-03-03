import { NextResponse } from "next/server";
import { createTask } from "@/entities/task/taskRepository";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = await createTask(body);
    return NextResponse.json({ ok: true, data: { id } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}