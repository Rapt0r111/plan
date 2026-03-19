/**
 * @file route.ts — app/api/tasks
 *
 * ИСПРАВЛЕНИЕ: добавлена Zod-валидация для POST.
 *   БЫЛО: body -> createTask(body) — без проверки.
 *         epicId мог быть строкой, title мог отсутствовать.
 *   СТАЛО: CreateTaskSchema — все обязательные поля проверены,
 *          defaults для status/priority/sortOrder.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createTask } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

const CreateTaskSchema = z.object({
  epicId:      z.number().int().positive(),
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  status:      z.enum(["todo", "in_progress", "done", "blocked"]).default("todo"),
  priority:    z.enum(["low", "medium", "high", "critical"]).default("medium"),
  dueDate:     z.string().datetime().nullable().optional(),
  sortOrder:   z.number().int().min(0).default(0),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CreateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { id } = await createTask(parsed.data);
    revalidateTag(EPICS_CACHE_TAG, "max");

    return NextResponse.json({ ok: true, data: { id } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}