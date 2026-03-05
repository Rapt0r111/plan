/**
 * @file route.ts — app/api/tasks/[id]
 *
 * PATCH /api/tasks/:id — обновление задачи.
 *
 * После мутации вызываем revalidateTag("epics"), чтобы сбросить
 * unstable_cache в репозитории. Следующий SSR-рендер получит свежие данные.
 *
 * Без этого unstable_cache продолжал бы отдавать устаревшие данные
 * до истечения TTL (30 сек), и статус/прогресс на дашборде
 * не обновлялся бы при обновлении страницы.
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

    // Сбрасываем кеш эпиков — статус задачи изменился,
    // данные на /dashboard и /board должны быть актуальными
    revalidateTag(EPICS_CACHE_TAG, "default");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}