/**
 * @file route.ts — app/api/subtasks/[id]
 *
 * PATCH /api/subtasks/:id — переключение чекбокса подзадачи.
 *
 * ИСПРАВЛЕНИЕ: revalidateTag() принимает ОДИН аргумент.
 * Предыдущий вызов revalidateTag(EPICS_CACHE_TAG, "default")
 * передавал второй аргумент, который не существует в API Next.js.
 * Это не вызывало ошибку (TypeScript не проверяет лишние аргументы
 * для некоторых сигнатур), но кеш мог инвалидироваться некорректно
 * в зависимости от версии Next.js.
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

    revalidateTag(EPICS_CACHE_TAG, "max");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}