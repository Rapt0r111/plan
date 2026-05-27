import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createNotification,
  listNotifications,
  markNotificationsRead,
} from "@/entities/management/managementRepository";
import { authErrorToResponse, requireAdminSession, requireSession } from "@/shared/lib/route-auth";

export const dynamic = "force-dynamic";

const CreateNotificationSchema = z.object({
  recipientUserId: z.string().nullable().optional(),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(1000),
  kind: z.string().max(40).optional(),
  entityType: z.string().max(80).nullable().optional(),
  entityId: z.union([z.string(), z.number()]).nullable().optional(),
});

const MarkReadSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export async function GET() {
  try {
    const session = await requireSession();
    const personal = await listNotifications(session.user.id);
    const global = await listNotifications(null);
    return NextResponse.json({
      ok: true,
      data: [...personal, ...global].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50),
    });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminSession();
    const parsed = CreateNotificationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }
    const notification = await createNotification(parsed.data);
    return NextResponse.json({ ok: true, data: notification }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireSession();
    const parsed = MarkReadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }
    await markNotificationsRead(parsed.data.ids);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
