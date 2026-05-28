import { headers } from "next/headers";
import { auth } from "@/shared/lib/auth";

import { hasLinkedProfile } from "@/shared/lib/auth-access";
import { resolveAccessScope } from "@/shared/lib/access-scope";

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

export async function requireSession() {
  const session = await requireAuthenticatedSession();
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
  if (session.user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export function authErrorToResponse(error: unknown): { status: number; message: string; code?: string } | null {
  const msg = String(error);
  if (msg.includes("UNAUTHORIZED")) return { status: 401, message: "Unauthorized", code: "UNAUTHORIZED" };
  if (msg.includes("PROFILE_REQUIRED")) return { status: 403, message: "Profile assignment required", code: "PROFILE_REQUIRED" };
  if (msg.includes("ACCESS_DENIED")) return { status: 403, message: "Access denied", code: "ACCESS_DENIED" };
  if (msg.includes("FORBIDDEN")) return { status: 403, message: "Forbidden: requires admin role", code: "FORBIDDEN" };
  return null;
}
