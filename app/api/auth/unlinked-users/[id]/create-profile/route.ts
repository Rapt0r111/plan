import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createUser, getAuthUserById, getUserWithMetaById, linkAuthUserToProfile, deleteUser, USERS_CACHE_TAG } from "@/entities/user/userRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";

const CreateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  login: z.string().min(1).max(64).optional(),
  roleId: z.number().int().positive(),
  initials: z.string().min(1).max(2).optional(),
});
type Params = { params: Promise<{ id: string }> };

function loginFromAuth(authUser: { login: string | null; email: string }) {
  return authUser.login?.trim() || authUser.email.split("@")[0] || "user";
}

export async function POST(req: Request, { params }: Params) {
  let createdProfileId: number | null = null;
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const body = await req.json();
    const parsed = CreateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }

    const authUser = await getAuthUserById(id);
    if (!authUser) return NextResponse.json({ ok: false, error: "Auth user not found" }, { status: 404 });
    if (authUser.profileId) return NextResponse.json({ ok: false, error: "Account already linked" }, { status: 409 });

    const profile = await createUser({
      name: parsed.data.name?.trim() || authUser.name,
      login: parsed.data.login?.trim() || loginFromAuth(authUser),
      roleId: parsed.data.roleId,
      initials: parsed.data.initials?.trim().toUpperCase(),
      accountStatus: "active",
    });
    createdProfileId = profile.id;
    await linkAuthUserToProfile(profile.id, authUser.id);
    const data = await getUserWithMetaById(profile.id);

    revalidateTag(USERS_CACHE_TAG, "max");
    revalidateTag(EPICS_CACHE_TAG, "max");
    await writeAuditLog({
      actor: { userId: session.user.id, role: session.user.role },
      action: "create",
      entityType: "user_profile",
      entityId: profile.id,
      after: data,
      metadata: { authUserId: authUser.id, source: "self_registration" },
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e) {
    if (createdProfileId) await deleteUser(createdProfileId).catch(() => undefined);
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message, code: authErr.code }, { status: authErr.status });
    if (String(e).includes("UNIQUE")) return NextResponse.json({ ok: false, error: "Login already exists" }, { status: 409 });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
