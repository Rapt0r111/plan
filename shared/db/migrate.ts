/**
 * @file migrate.ts - shared/db
 * Run: bun run src/shared/db/migrate.ts
 */
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "local.db");
const MIGRATIONS_DIR = path.resolve(process.cwd(), "drizzle");

console.log("Running migrations from", MIGRATIONS_DIR);

const sqlite = new Database(DB_PATH, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

const db = drizzle(sqlite);
migrate(db, { migrationsFolder: MIGRATIONS_DIR });

console.log("Migrations complete.");
sqlite.close();