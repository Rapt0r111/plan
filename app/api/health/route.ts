/**
 * @file route.ts — app/api/health
 *
 * Endpoint для мониторинга состояния системы.
 * Полезен для инфраструктурных проверок и debugging.
 *
 * GET /api/health
 * Response: { ok, db, realtime, timestamp }
 */
import { NextResponse } from "next/server";
import { checkDbHealth } from "@/shared/db/client";
import { eventBus } from "@/shared/server/eventBus";

export const dynamic = "force-dynamic";

export async function GET() {
  const db       = await checkDbHealth();
  const realtime = { clients: eventBus.clientCount };

  const ok = db.ok;

  return NextResponse.json(
    {
      ok,
      db,
      realtime,
      timestamp: new Date().toISOString(),
      version:   process.env.npm_package_version ?? "0.1.0",
    },
    { status: ok ? 200 : 503 },
  );
}