/**
 * @file route.ts — app/api/tasks
 *
 * POST /api/tasks — создание новой задачи.
 *
 * ИСПРАВЛЕНИЕ: revalidateTag() принимает ОДИН аргумент.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createTask } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = await createTask(body);

    revalidateTag(EPICS_CACHE_TAG, "max");

    return NextResponse.json({ ok: true, data: { id } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}