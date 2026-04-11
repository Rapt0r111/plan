/**
 * @file route.ts — app/api/operative-tasks
 *
 * ИСПРАВЛЕНИЕ: добавлен console.error для диагностики 500-ошибок.
 * Убрана лишняя операция revalidateTag (нет cache в force-dynamic роутах).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOperativeTask } from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";

export const OPERATIVE_CACHE_TAG = "operative-tasks";

const CreateSchema = z.object({
  userId:      z.number().int().positive(),
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  dueDate:     z.string().datetime().nullable().optional(),
  sortOrder:   z.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = CreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { sortOrder, ...rest } = parsed.data;

    const task = await createOperativeTask({
      ...rest,
      sortOrder: sortOrder ?? 0,
    });

    if (!task) {
      console.error("[operative-tasks POST] createOperativeTask returned undefined");
      return NextResponse.json(
        { ok: false, error: "DB insert returned no row" },
        { status: 500 },
      );
    }

    broadcast("task:created", {
      source: "operative",
      taskId: task.id,
      userId: task.userId,
    });

    return NextResponse.json({ ok: true, data: task }, { status: 201 });
  } catch (e) {
    // ← Это покажет реальную причину ошибки в dev-консоли
    console.error("[operative-tasks POST] ERROR:", e);
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 },
    );
  }
}