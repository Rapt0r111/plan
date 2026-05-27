import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSettings, upsertAppSetting } from "@/entities/management/managementRepository";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

export const dynamic = "force-dynamic";

const AppSettingsSchema = z.record(z.string(), z.unknown());

export async function GET() {
  try {
    await requireAdminSession();
    return NextResponse.json({ ok: true, data: await getAppSettings() });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAdminSession();
    const parsed = AppSettingsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }
    const before = await getAppSettings();
    for (const [key, value] of Object.entries(parsed.data)) {
      await upsertAppSetting(key, value);
    }
    const after = await getAppSettings();
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "update",
      entityType: "app_settings",
      before,
      after,
    });
    return NextResponse.json({ ok: true, data: after });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
