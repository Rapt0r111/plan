/**
 * @file route.ts — app/api/operative-tasks/[id]/status
 *
 * PATCH /api/operative-tasks/:id/status
 *
 * ═══════════════════════════════════════════════════════════════
 * GUEST ENDPOINT — Доступен любому аутентифицированному пользователю.
 * Разрешает только переключение статуса между "todo" и "done"
 * (готово / не готово). Это единственная мутация доступная не-администраторам.
 *
 * Администраторы используют PATCH /api/operative-tasks/:id для
 * полного управления (любой статус, дедлайн, DnD и т.д.).
 * ═══════════════════════════════════════════════════════════════
 */

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getOperativeTaskById, updateOperativeTaskStatus } from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { OPERATIVE_CACHE_TAG } from "../../route";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";
import { auditMutation } from "@/shared/lib/auditHelpers";

const GuestStatusSchema = z.object({
  // Guest can only toggle done / not-done
  done: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    // ── Auth check — any authenticated user ──────────────────────────────────
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body   = await req.json() as unknown;
    const parsed = GuestStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const beforeTask = await getOperativeTaskById(taskId);
    if (!beforeTask) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // Map boolean done → status string
    const newStatus = parsed.data.done ? "done" : "todo";

    // Prevent no-op
    if (beforeTask.status === newStatus) {
      return NextResponse.json({ ok: true, data: beforeTask });
    }

    const task = await updateOperativeTaskStatus(taskId, newStatus);

    revalidateTag(OPERATIVE_CACHE_TAG, "max");
    broadcast("task:updated", { source: "operative", taskId, status: newStatus });

    // ── Audit log ──────────────────────────────────────────────────────────
    await auditMutation(req, {
      action:      "STATUS_CHANGE",
      entityType:  "operative_task",
      entityId:    taskId,
      entityTitle: beforeTask.title,
      details: {
        before: { status: beforeTask.status },
        after:  { status: newStatus },
        actorRole: session.user.role ?? "member",
      },
    });

    return NextResponse.json({ ok: true, data: task });
  } catch (e) {
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}