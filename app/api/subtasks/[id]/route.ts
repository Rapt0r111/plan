/**
 * @file route.ts — app/api/subtasks/[id]
 *
 * PATCH /api/subtasks/:id — переключение чекбокса подзадачи.
 *
 * Инвалидируем тег "epics" после изменения подзадачи.
 * Прогресс задачи (done/total подзадач) влияет на данные,
 * которые кешируются в getAllEpicsWithTasks(), поэтому кеш
 * должен сбрасываться и здесь.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { toggleSubtask } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { isCompleted } = await req.json();
    await toggleSubtask(Number(params.id), isCompleted);

    // Подзадача изменилась → прогресс задачи изменился → кеш устарел
    revalidateTag(EPICS_CACHE_TAG, "default");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}