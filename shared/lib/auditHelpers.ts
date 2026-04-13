/**
 * @file auditHelpers.ts — shared/lib
 *
 * Utilities for extracting actor info from Next.js API requests
 * and writing audit entries consistently across all Route Handlers.
 */

import { auth } from "./auth";
import { headers } from "next/headers";
import { writeAudit, type WriteAuditParams } from "@/shared/db/auditRepository";
import type { AuditAction, AuditEntityType } from "@/shared/db/schema";

/**
 * getActorFromRequest — resolves the current user from session.
 * Returns null if unauthenticated.
 */
export async function getActorFromRequest(): Promise<{
  email: string;
  role: string;
} | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.email) return null;
    return {
      email: session.user.email,
      role: session.user.role ?? "member",
    };
  } catch {
    return null;
  }
}

/**
 * getRequestMeta — extracts IP and User-Agent for audit records.
 */
export async function getRequestMeta(req: Request): Promise<{
  ipAddress: string;
  userAgent: string;
}> {
  const hdrs = await headers();
  return {
    ipAddress: (
      hdrs.get("x-forwarded-for") ??
      hdrs.get("x-real-ip") ??
      req.headers.get("x-forwarded-for") ??
      "unknown"
    ).split(",")[0].trim(),
    userAgent: req.headers.get("user-agent") ?? "unknown",
  };
}

/**
 * auditMutation — convenience wrapper used in Route Handlers.
 *
 * @example
 * await auditMutation(req, {
 *   action: "UPDATE",
 *   entityType: "task",
 *   entityId: taskId,
 *   entityTitle: "Fix login bug",
 *   details: { before: { status: "todo" }, after: { status: "done" } },
 * });
 */
export async function auditMutation(
  req: Request,
  params: Omit<WriteAuditParams, "actorEmail" | "actorRole" | "ipAddress" | "userAgent">
): Promise<void> {
  const [actor, meta] = await Promise.all([
    getActorFromRequest(),
    getRequestMeta(req),
  ]);

  await writeAudit({
    actorEmail:  actor?.email ?? "anonymous",
    actorRole:   actor?.role ?? "member",
    ...params,
    ipAddress:   meta.ipAddress,
    userAgent:   meta.userAgent,
  });
}