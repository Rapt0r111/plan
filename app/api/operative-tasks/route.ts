/**
 * @file route.ts — app/api/operative-tasks
 *
 * POST /api/operative-tasks — создать оперативную задачу для пользователя.
 * Удаление не поддерживается.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createOperativeTask } from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";

export const OPERATIVE_CACHE_TAG = "operative-tasks";

const CreateSchema = z.object({
  userId:      z.number().int().positive(),
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  sortOrder:   z.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  try {
    const body   = await req.json();
    const parsed = CreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const task = await createOperativeTask(parsed.data);
    revalidateTag(OPERATIVE_CACHE_TAG, "max");
    broadcast("task:created", { source: "operative", taskId: task.id, userId: task.userId });

    return NextResponse.json({ ok: true, data: task }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}