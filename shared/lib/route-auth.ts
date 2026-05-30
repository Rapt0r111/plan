import { headers } from "next/headers";
import { auth } from "@/shared/lib/auth";

import { hasLinkedProfile, requiresPasswordChange } from "@/shared/lib/auth-access";
import { resolveAccessScope } from "@/shared/lib/access-scope";
import { authErrorToResponse } from "@/shared/lib/auth-errors";

export async function optionalSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireAuthenticatedSession() {
  const session = await getCurrentSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

function assertPasswordChangeCompleted(session: Awaited<ReturnType<typeof getCurrentSession>>) {
  if (session?.user && requiresPasswordChange(session.user)) {
    throw new Error("PASSWORD_CHANGE_REQUIRED");
  }
}

export async function requireSession() {
  const session = await requireAuthenticatedSession();
  assertPasswordChangeCompleted(session);
  if (!hasLinkedProfile(session.user)) {
    throw new Error("PROFILE_REQUIRED");
  }
  return session;
}

export async function requireWorkspaceAccess() {
  const session = await requireSession();
  return resolveAccessScope(session);
}

export async function requireAdminSession() {
  const session = await requireAuthenticatedSession();
  assertPasswordChangeCompleted(session);
  if (session.user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export { authErrorToResponse };
