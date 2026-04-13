/**
 * @file route.ts — app/api/epics/[id]
 *
 * ИСПРАВЛЕНИЕ: добавлена Zod-валидация для PATCH.
 *   БЫЛО: body -> updateEpic(Number(id), body) — без проверки.
 *         Принимал любые поля, включая несуществующие колонки в БД.
 *   СТАЛО: PatchEpicSchema — whitelist допустимых полей.
 *          color: regex /^#[0-9a-fA-F]{6}$/ — отклоняет невалидные hex.
 *          startDate/endDate: z.string().datetime() — ISO-8601 строго.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  getEpicById,
  updateEpic,
  deleteEpic,
  EPICS_CACHE_TAG,
} from "@/entities/epic/epicRepository";
import { authErrorToResponse, requireAdminSession, requireSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const PatchEpicSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  startDate:   z.string().datetime().nullable().optional(),
  endDate:     z.string().datetime().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const epicId = Number(id);

    if (!Number.isInteger(epicId) || epicId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid epic id" }, { status: 400 });
    }

    const epic = await getEpicById(epicId);
    if (!epic) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, data: epic });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const epicId = Number(id);

    if (!Number.isInteger(epicId) || epicId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid epic id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = PatchEpicSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 422 });
    }

    const before = await getEpicById(epicId);
    const epic = await updateEpic(epicId, parsed.data);
    revalidateTag(EPICS_CACHE_TAG, "max");
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "update",
      entityType: "epic",
      entityId: epicId,
      before,
      after: epic,
    });

    return NextResponse.json({ ok: true, data: epic });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const epicId = Number(id);

    if (!Number.isInteger(epicId) || epicId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid epic id" }, { status: 400 });
    }

    const before = await getEpicById(epicId);
    await deleteEpic(epicId);
    revalidateTag(EPICS_CACHE_TAG, "max");
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "delete",
      entityType: "epic",
      entityId: epicId,
      before,
      after: null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
