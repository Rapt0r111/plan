import { NextResponse } from "next/server";
import { db } from "@/shared/db/client";
import { auditLogs } from "@/shared/db/schema";
import { desc, eq, and, gte, like } from "drizzle-orm";
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
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const parsed = rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      actorRole: row.actorRole,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.beforeJson ? safeParseJSON(row.beforeJson) : null,
      after: row.afterJson ? safeParseJSON(row.afterJson) : null,
      metadata: row.metadataJson ? safeParseJSON(row.metadataJson) : null,
      createdAt: row.createdAt,
    }));

    return NextResponse.json({ ok: true, data: parsed, page, limit });
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