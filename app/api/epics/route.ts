/**
 * @file route.ts — app/api/epics
 *
 * ИСПРАВЛЕНИЕ: добавлена Zod-валидация для POST.
 *   БЫЛО: if (!body.title) — минимальная проверка.
 *         body.color мог быть "red", "javascript:alert(1)", произвольной строкой.
 *         body.startDate мог быть невалидной датой.
 *   СТАЛО: CreateEpicSchema — color с regex /^#[0-9a-fA-F]{6}$/,
 *          даты через z.string().datetime(), title с min/max.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getAllEpics, createEpic, EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

const CreateEpicSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8b5cf6"),
  startDate:   z.string().datetime().nullable().optional(),
  endDate:     z.string().datetime().nullable().optional(),
});

export async function GET() {
  try {
    const data = await getAllEpics();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CreateEpicSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const epic = await createEpic(parsed.data);
    revalidateTag(EPICS_CACHE_TAG, "max");

    return NextResponse.json({ ok: true, data: epic }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}