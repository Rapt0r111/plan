/**
 * @file route.ts — app/api/epics
 *
 * Permissions:
 *   GET  — anyone
 *   POST — anyone (actor logged as anonymous if unauthenticated)
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getAllEpics, createEpic, EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { optionalSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

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
    const session = await optionalSession();
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
    await writeAuditLog({
      actor: session
        ? { userId: session.user.id, role: session.user.role }
        : { userId: null, role: null },
      action: "create",
      entityType: "epic",
      entityId: epic.id,
      after: epic,
    });

    return NextResponse.json({ ok: true, data: epic }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}