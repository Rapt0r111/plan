/**
 * @file route.ts — app/api/audit
 *
 * GET /api/audit — paginated audit log (admin only)
 *
 * Query params:
 *   limit       number (default 50, max 200)
 *   offset      number (default 0)
 *   entityType  string
 *   entityId    number
 *   actorEmail  string (partial match)
 *   action      string
 */

import { NextResponse } from "next/server";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";
import { readAuditLog, getAuditStats } from "@/shared/db/auditRepository";
import type { AuditEntityType, AuditAction } from "@/shared/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // ── Auth check — admin only ───────────────────────────────────────────────
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden: admin only" }, { status: 403 });
    }

    const url = new URL(req.url);
    const p   = url.searchParams;

    const limit  = Math.min(Number(p.get("limit") ?? 50), 200);
    const offset = Number(p.get("offset") ?? 0);

    const [result, stats] = await Promise.all([
      readAuditLog({
        limit,
        offset,
        entityType: (p.get("entityType") as AuditEntityType) || undefined,
        entityId:   p.get("entityId") ? Number(p.get("entityId")) : undefined,
        actorEmail: p.get("actorEmail") ?? undefined,
        action:     (p.get("action") as AuditAction) || undefined,
      }),
      offset === 0 ? getAuditStats() : undefined,
    ]);

    return NextResponse.json({
      ok: true,
      data: result.entries,
      total: result.total,
      stats: stats ?? null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}