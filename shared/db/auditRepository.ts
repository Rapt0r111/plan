/**
 * @file auditRepository.ts — shared/db
 *
 * Write and read audit log entries.
 * Called from API Route Handlers after every successful mutation.
 *
 * DESIGN:
 *   - writeAudit() is fire-and-forget — it never throws.
 *     If logging fails the primary operation should NOT be rolled back.
 *   - readAuditLog() is admin-only (checked in the API route, not here).
 *   - Details are stored as a compact JSON string to keep the row small.
 */

import { db } from "./client";
import { auditLog, type AuditAction, type AuditEntityType } from "./schema";
import { desc, eq, and, like, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type AuditLogRow = InferSelectModel<typeof auditLog>;

export interface WriteAuditParams {
  actorEmail:  string;
  actorRole:   string;
  action:      AuditAction;
  entityType:  AuditEntityType;
  entityId?:   number;
  entityTitle?: string;
  details?:    Record<string, unknown>;
  ipAddress?:  string;
  userAgent?:  string;
}

/**
 * writeAudit — persists an audit record.
 * NEVER throws — failures are silently swallowed so the caller is unaffected.
 */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorEmail:  params.actorEmail,
      actorRole:   params.actorRole,
      action:      params.action,
      entityType:  params.entityType,
      entityId:    params.entityId ?? null,
      entityTitle: params.entityTitle ?? null,
      details:     params.details ? JSON.stringify(params.details) : null,
      ipAddress:   params.ipAddress ?? null,
      userAgent:   params.userAgent ? params.userAgent.slice(0, 500) : null,
    });
  } catch (err) {
    // Audit failures must never break the primary operation
    console.error("[auditRepository] writeAudit failed:", err);
  }
}

export interface ReadAuditParams {
  limit?:      number;
  offset?:     number;
  entityType?: AuditEntityType;
  entityId?:   number;
  actorEmail?: string;
  action?:     AuditAction;
}

/**
 * readAuditLog — paged list of audit entries, newest first.
 */
export async function readAuditLog(params: ReadAuditParams = {}): Promise<{
  entries: AuditLogRow[];
  total: number;
}> {
  const {
    limit = 50,
    offset = 0,
    entityType,
    entityId,
    actorEmail,
    action,
  } = params;

  const conditions = [];
  if (entityType) conditions.push(eq(auditLog.entityType, entityType));
  if (entityId != null) conditions.push(eq(auditLog.entityId, entityId));
  if (actorEmail) conditions.push(like(auditLog.actorEmail, `%${actorEmail}%`));
  if (action) conditions.push(eq(auditLog.action, action));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [entries, countRows] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(auditLog)
      .where(where),
  ]);

  return {
    entries,
    total: countRows[0]?.count ?? 0,
  };
}

/**
 * getAuditStats — summary counts for dashboard display.
 */
export async function getAuditStats(): Promise<{
  total: number;
  today: number;
  byAction: Record<string, number>;
}> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [totalRow, todayRow, byActionRows] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)`.mapWith(Number) }).from(auditLog),
      db
        .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
        .from(auditLog)
        .where(like(auditLog.createdAt, `${todayStr}%`)),
      db
        .select({
          action: auditLog.action,
          count: sql<number>`COUNT(*)`.mapWith(Number),
        })
        .from(auditLog)
        .groupBy(auditLog.action),
    ]);

    const byAction: Record<string, number> = {};
    for (const row of byActionRows) {
      byAction[row.action] = row.count;
    }

    return {
      total: totalRow[0]?.count ?? 0,
      today: todayRow[0]?.count ?? 0,
      byAction,
    };
  } catch {
    return { total: 0, today: 0, byAction: {} };
  }
}