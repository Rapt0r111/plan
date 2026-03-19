/**
 * @file route.ts — app/api/subtasks/[id]
 *
 * ИСПРАВЛЕНИЕ: добавлена Zod-валидация для PATCH.
 *   БЫЛО: const { isCompleted } = await req.json()
 *         isCompleted передавался в toggleSubtask() без проверки типа.
 *         Клиент мог прислать строку "true", число 1, null — всё проходило.
 *   СТАЛО: ToggleSubtaskSchema — z.boolean() гарантирует строгий boolean.
 *          Строка "true" или число 1 теперь вернут 422.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { toggleSubtask } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

const ToggleSubtaskSchema = z.object({
  isCompleted: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const subtaskId = Number(id);

    if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid subtask id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = ToggleSubtaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    await toggleSubtask(subtaskId, parsed.data.isCompleted);
    revalidateTag(EPICS_CACHE_TAG, "max");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}