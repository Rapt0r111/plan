/**
 * @file route.ts — app/api/operative-subtasks/[id]
 *
 * ИСПРАВЛЕНИЯ:
 *   1. Добавлена проверка аутентификации на PATCH
 *   2. Только администраторы могут переключать статус подзадач
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { toggleOperativeSubtask } from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { OPERATIVE_CACHE_TAG } from "../../operative-tasks/route";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";

const ToggleSchema = z.object({
  isCompleted: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    // ── Проверка аутентификации ──────────────────────────────────────────────
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Forbidden: requires admin role" },
        { status: 403 },
      );
    }

    const { id }     = await params;
    const subtaskId  = Number(id);

    if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid subtask id" }, { status: 400 });
    }

    const body   = await req.json();
    const parsed = ToggleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const subtask = await toggleOperativeSubtask(subtaskId, parsed.data.isCompleted);
    revalidateTag(OPERATIVE_CACHE_TAG, "max");
    broadcast("task:subtask:toggled", {
      source:      "operative",
      subtaskId,
      taskId:      subtask.taskId,
      isCompleted: parsed.data.isCompleted,
    });

    return NextResponse.json({ ok: true, data: subtask });
  } catch (e) {
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}