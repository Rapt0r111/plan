import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/shared/lib/auth";
import { db } from "@/shared/db/client";
import { authUsers } from "@/shared/db/schema";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const BodySchema = z.object({
  newPassword: z.string().min(8, "Новый пароль должен содержать не менее 8 символов").max(128),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid user id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const [targetUser] = await db.select().from(authUsers).where(eq(authUsers.profileId, parsedId));
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "Auth user not found" }, { status: 404 });
    }

    await db.update(authUsers).set({ forcePasswordChange: true }).where(eq(authUsers.id, targetUser.id));

    try {
      const result = await auth.api.setUserPassword({
        body: {
          userId: targetUser.id,
          newPassword: parsed.data.newPassword,
        },
        headers: await headers(),
      });
      if (!result?.status) {
        throw new Error("Failed to set password");
      }
    } catch (error) {
      await db.update(authUsers).set({ forcePasswordChange: false }).where(eq(authUsers.id, targetUser.id));
      throw error;
    }

    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "auth.force_password_change",
      entityType: "auth_user",
      entityId: targetUser.id,
      before: { forcePasswordChange: false },
      after: { forcePasswordChange: true },
      metadata: { profileId: parsedId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message, code: authErr.code }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
