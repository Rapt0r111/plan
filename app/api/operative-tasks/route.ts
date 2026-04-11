/**
 * @file route.ts — app/api/operative-tasks
 *
 * ИСПРАВЛЕНИЯ:
 *   1. Добавлена проверка аутентификации — неавторизованные получают 401
 *   2. POST только для администраторов — остальные получают 403
 *   Раньше маршрут был полностью открыт без авторизации.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOperativeTask } from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";

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
    // ── Проверка аутентификации ──────────────────────────────────────────────
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // ── Проверка прав администратора ─────────────────────────────────────────
    if (session.user.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Forbidden: requires admin role" },
        { status: 403 },
      );
    }

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
    console.error("[operative-tasks POST] ERROR:", e);
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 },
    );
  }
}