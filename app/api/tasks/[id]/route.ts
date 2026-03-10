// app/api/tasks/[id]/route.ts — добавить DELETE
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { updateTask, deleteTask } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    await updateTask(Number(id), body);
    revalidateTag(EPICS_CACHE_TAG, "max");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteTask(Number(id));
    revalidateTag(EPICS_CACHE_TAG, "max");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}