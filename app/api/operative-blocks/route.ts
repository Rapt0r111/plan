/**
 * @file route.ts — app/api/operative-blocks
 *
 * PATCH /api/operative-blocks
 *
 * Обновляет `block_order` для набора пользователей — сохраняет DnD-порядок
 * блоков на странице оперативных задач в базе данных.
 *
 * Порядок хранится в поле `users.block_order` и виден ВСЕМ участникам.
 *
 * Permissions: admin only (перестановка блоков — привилегия администратора).
 *
 * Body: { items: Array<{ id: number; blockOrder: number }> }
 * Response: { ok: true }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateUserBlockOrders } from "@/entities/operative/operativeRepository";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

const UpdateBlockOrderSchema = z.object({
  items: z.array(
    z.object({
      id:         z.number().int().positive(),
      blockOrder: z.number().int().min(0),
    })
  ).min(1).max(200),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireAdminSession();

    const body   = await req.json();
    const parsed = UpdateBlockOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    await updateUserBlockOrders(parsed.data.items);

    // Уведомляем всех участников о смене порядка через SSE →
    // их страницы оперативных задач обновятся без ручного reload
    broadcast("task:updated", {
      source: "operative",
      type:   "block_reorder",
      items:  parsed.data.items,
    });

    await writeAuditLog({
      actor:      { userId: session.user.id, role: session.user.role },
      action:     "reorder",
      entityType: "user_profile",
      metadata:   { items: parsed.data.items },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) {
      return NextResponse.json(
        { ok: false, error: authErr.message },
        { status: authErr.status },
      );
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}