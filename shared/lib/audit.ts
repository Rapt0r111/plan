import { db } from "@/shared/db/client";
import { auditLogs } from "@/shared/db/schema";

type Actor = { userId?: string | null; role?: string | null };

export async function writeAuditLog(params: {
  actor?: Actor;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}) {
  await db.insert(auditLogs).values({
    actorUserId: params.actor?.userId ?? null,
    actorRole: params.actor?.role ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId != null ? String(params.entityId) : null,
    beforeJson: params.before !== undefined ? JSON.stringify(params.before) : null,
    afterJson: params.after !== undefined ? JSON.stringify(params.after) : null,
    metadataJson: params.metadata !== undefined ? JSON.stringify(params.metadata) : null,
  });
}
