/**
 * @file route.ts — app/api/tasks/[id]
 *
 * PATCH /api/tasks/:id — обновление задачи.
 *
 * ИСПРАВЛЕНИЕ: revalidateTag() принимает ОДИН аргумент.
 * Вызов revalidateTag(tag, "default") — некорректен.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { updateTask } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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