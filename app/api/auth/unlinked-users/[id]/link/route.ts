import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getAuthUserById, getUserById, getUserWithMetaById, linkAuthUserToProfile, USERS_CACHE_TAG } from "@/entities/user/userRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const LinkSchema = z.object({ profileId: z.number().int().positive() });
type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const body = await req.json();
    const parsed = LinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const [authUser, profile] = await Promise.all([
      getAuthUserById(id),
      getUserById(parsed.data.profileId),
    ]);
    if (!authUser) return NextResponse.json({ ok: false, error: "Auth user not found" }, { status: 404 });
    if (authUser.profileId) return NextResponse.json({ ok: false, error: "Account already linked" }, { status: 409 });
    if (!profile) return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
    if (profile.authUserId) return NextResponse.json({ ok: false, error: "Profile already has account" }, { status: 409 });

    await linkAuthUserToProfile(profile.id, authUser.id);
    const data = await getUserWithMetaById(profile.id);
    revalidateTag(USERS_CACHE_TAG, "max");
    revalidateTag(EPICS_CACHE_TAG, "max");
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "update",
      entityType: "auth_profile_link",
      entityId: authUser.id,
      before: { authUserId: authUser.id, profileId: authUser.profileId },
      after: { authUserId: authUser.id, profileId: profile.id },
    });

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message, code: authErr.code }, { status: authErr.status });
    if (String(e).includes("UNIQUE")) return NextResponse.json({ ok: false, error: "Account or profile already linked" }, { status: 409 });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
