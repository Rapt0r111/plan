/**
 * @file client.ts - shared/db
 * Singleton Drizzle client using Bun's native bun:sqlite.
 * bun:sqlite — встроен в Bun, нет npm-пакета, в 3-6x быстрее better-sqlite3.
 */
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "local.db");

const globalForDb = globalThis as unknown as { _db?: ReturnType<typeof createDb> };

function createDb() {
  const sqlite = new Database(DB_PATH, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA synchronous = NORMAL;");
  return drizzle(sqlite, { schema });
}

export const db = globalForDb._db ?? (globalForDb._db = createDb());
export type Db = typeof db;