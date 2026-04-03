/**
 * @file client.ts — shared/db
 *
 * ═══════════════════════════════════════════════════════════════
 * DATABASE CLIENT — LIBSQL-READY ABSTRACTION
 * ═══════════════════════════════════════════════════════════════
 *
 * ТЕКУЩЕЕ СОСТОЯНИЕ: Bun native SQLite (локальный файл)
 * ЦЕЛЕВОЕ СОСТОЯНИЕ: LibSQL (Turso) — embedded replica с edge-sync
 *
 * МИГРАЦИЯ (когда вырастете до 20+ пользователей):
 *
 *   1. Установить клиент:
 *      bun add @libsql/client drizzle-orm
 *
 *   2. Создать Turso БД:
 *      turso db create plan-prod
 *      turso db tokens create plan-prod
 *
 *   3. Добавить переменные окружения:
 *      LIBSQL_URL=libsql://plan-prod-xxx.turso.io
 *      LIBSQL_AUTH_TOKEN=eyJh...
 *
 *   4. Переключить CLIENT_MODE на "libsql" в .env:
 *      DATABASE_CLIENT=libsql
 *
 *   5. Схема и все запросы остаются ИДЕНТИЧНЫМИ.
 *      Меняется только этот файл (драйвер).
 *
 * ПОЧЕМУ LIBSQL ЛУЧШЕ POSTGRESQL ДЛЯ ЭТОГО СЛУЧАЯ:
 *   LibSQL = SQLite + embedded replica + WASM-ready
 *   - Нет сетевого overhead (embedded replica работает локально)
 *   - Turso синхронизирует реплики с edge-сервером асинхронно
 *   - Сохраняет все преимущества SQLite (< 0.5мс запросы)
 *   - Добавляет HA (high availability) при отказе ноды
 *   - schema.ts и все репозитории не меняются (это главное!)
 *
 * ССЫЛКИ:
 *   https://turso.tech/libsql
 *   https://orm.drizzle.team/docs/connect-turso
 */

import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { resolve } from "path";
import * as schema from "./schema";

// ── Environment detection ─────────────────────────────────────────────────────

const DB_PATH = resolve(process.cwd(), "local.db");

// ── Client factory ────────────────────────────────────────────────────────────

/**
 * createBunSQLiteClient — текущий драйвер.
 * Максимальная производительность на одном сервере.
 */
function createBunSQLiteClient() {
  const sqlite = new Database(DB_PATH, {
    // WAL mode is enabled during migrations/seed; the client doesn't switch it.
    strict: true,
  });

  // Performance pragmas.
  //
  // IMPORTANT:
  // `PRAGMA journal_mode` requires an exclusive lock.
  // During `next build`, multiple workers may import this module concurrently,
  // which can trigger `SQLiteError: database is locked`.
  // We enable WAL during migrations/seed instead.
  sqlite.run("PRAGMA busy_timeout = 5000;");
  sqlite.run("PRAGMA synchronous=NORMAL;");
  sqlite.run("PRAGMA foreign_keys=ON;");
  sqlite.run("PRAGMA cache_size=-65536;"); // 64MB cache
  sqlite.run("PRAGMA temp_store=MEMORY;");
  sqlite.run("PRAGMA mmap_size=268435456;"); // 256MB mmap

  return drizzle(sqlite, { schema, logger: process.env.NODE_ENV === "development" });
}

// ── FUTURE: LibSQL/Turso client (uncomment when migrating) ───────────────────
//
// import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
// import { createClient } from "@libsql/client";
//
// function createLibSQLClient() {
//   const url   = process.env.LIBSQL_URL   ?? "file:local.db";
//   const token = process.env.LIBSQL_AUTH_TOKEN;
//
//   const client = createClient({ url, authToken: token });
//   return drizzleLibsql(client, { schema, logger: process.env.NODE_ENV === "development" });
// }

// ── Singleton ─────────────────────────────────────────────────────────────────

// Singleton prevents multiple connections in development (HMR)
const SYMBOL = Symbol.for("plan:db");
type GlobalWithDB = typeof globalThis & { [SYMBOL]?: ReturnType<typeof createBunSQLiteClient> };
const g = globalThis as GlobalWithDB;

if (!g[SYMBOL]) {
  g[SYMBOL] = createBunSQLiteClient();
  // Switch to LibSQL: g[SYMBOL] = createLibSQLClient();
}

export const db = g[SYMBOL]!;

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * checkDbHealth — для /api/health эндпоинта.
 * Полезно для мониторинга в prod.
 */
export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    await db.run("SELECT 1");
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, latencyMs: -1 };
  }
}