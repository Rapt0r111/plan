import { headers } from "next/headers";
import { auth } from "@/shared/lib/auth";

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdminSession() {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export function authErrorToResponse(error: unknown): { status: number; message: string } | null {
  const msg = String(error);
  if (msg.includes("UNAUTHORIZED")) return { status: 401, message: "Unauthorized" };
  if (msg.includes("FORBIDDEN")) return { status: 403, message: "Forbidden: requires admin role" };
  return null;
}
