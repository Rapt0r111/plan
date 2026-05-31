import { NextResponse } from "next/server";
import { db } from "@/shared/db/client";
import { auditLogs, authUsers, users } from "@/shared/db/schema";
import { desc, eq, and, gte } from "drizzle-orm";
import { authErrorToResponse, requireAdminSession } from "@/shared/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") ?? "50")));
    const entityType = searchParams.get("entityType") ?? undefined;
    const action = searchParams.get("action") ?? undefined;
    const since = searchParams.get("since") ?? undefined;

    const offset = (page - 1) * limit;

    const conditions = [];
    if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
    if (action) conditions.push(eq(auditLogs.action, action));
    if (since) conditions.push(gte(auditLogs.createdAt, since));

    const rows = await db
      .select({
        audit: auditLogs,
        authName: authUsers.name,
        authLogin: authUsers.login,
        profileName: users.name,
        profileLogin: users.login,
        profileInitials: users.initials,
      })
      .from(auditLogs)
      .leftJoin(authUsers, eq(auditLogs.actorUserId, authUsers.id))
      .leftJoin(users, eq(authUsers.profileId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit)
      .offset(offset);

    const parsed = rows.map((row) => {
      const audit = row.audit;
      const actorName = row.profileName ?? row.authName ?? null;
      const actorLogin = row.profileLogin ?? row.authLogin ?? null;

      return {
        id: audit.id,
        actorUserId: audit.actorUserId,
        actorName,
        actorLogin,
        actorInitials: row.profileInitials ?? makeInitials(actorName ?? actorLogin ?? ""),
        actorRole: audit.actorRole,
        action: audit.action,
        entityType: audit.entityType,
        entityId: audit.entityId,
        before: audit.beforeJson ? safeParseJSON(audit.beforeJson) : null,
        after: audit.afterJson ? safeParseJSON(audit.afterJson) : null,
        metadata: audit.metadataJson ? safeParseJSON(audit.metadataJson) : null,
        createdAt: audit.createdAt,
      };
    });

    return NextResponse.json(
      { ok: true, data: parsed, page, limit },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr)
      return NextResponse.json(
        { ok: false, error: authErr.message },
        { status: authErr.status }
      );
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function makeInitials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
