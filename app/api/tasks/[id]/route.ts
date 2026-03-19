/**
 * @file route.ts — app/api/tasks/[id]
 *
 * ИСПРАВЛЕНИЕ: добавлена Zod-валидация для PATCH.
 *   БЫЛО: body -> updateTask(Number(id), body) — без проверки.
 *         Любые поля, любые типы проходили в DAL.
 *   СТАЛО: PatchTaskSchema — whitelist полей + строгие типы.
 *          Лишние поля Zod отсекает автоматически (strip mode по умолчанию).
 *          id параметр: Number.isInteger + > 0 (защита от "abc", "-1", "1.5").
 *          Пустой patch → 422 "Nothing to update".
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { updateTask, deleteTask } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

const PatchTaskSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status:      z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
  priority:    z.enum(["low", "medium", "high", "critical"]).optional(),
  dueDate:     z.string().datetime().nullable().optional(),
  epicId:      z.number().int().positive().optional(),
  sortOrder:   z.number().int().min(0).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = PatchTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 422 });
    }

    await updateTask(taskId, parsed.data);
    revalidateTag(EPICS_CACHE_TAG, "max");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    await deleteTask(taskId);
    revalidateTag(EPICS_CACHE_TAG, "max");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}