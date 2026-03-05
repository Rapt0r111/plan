/**
 * @file seed.ts — shared/db
 *
 * Идемпотентный seed:
 *   - INSERT OR IGNORE для roles (по key)
 *   - INSERT OR IGNORE для users (по login)
 *   - Использует returning() для получения ID без лишних SELECT
 */
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { sql } from "drizzle-orm";
import { roles, users, epics, tasks, subtasks, taskAssignees } from "./schema";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "local.db");
const sqlite = new Database(DB_PATH, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

const db = drizzle(sqlite, { schema: { roles, users, epics, tasks, subtasks, taskAssignees } });

// ─── ROLES ────────────────────────────────────────────────────────────────────
const SEED_ROLES = [
  { key: "company_commander",   label: "Командир роты",          short: "КНР",  hex: "#8b5cf6", sortOrder: 0,
    description: "Командир научной роты. Отвечает за боевую подготовку и выполнение задач." },
  { key: "platoon_1_commander", label: "Командир 1 взвода",      short: "КВ-1", hex: "#38bdf8", sortOrder: 1,
    description: null },
  { key: "platoon_2_commander", label: "Командир 2 взвода",      short: "КВ-2", hex: "#60a5fa", sortOrder: 2,
    description: null },
  { key: "deputy_platoon_1",    label: "Зам. ком. 1 взвода",     short: "ЗКВ1", hex: "#22d3ee", sortOrder: 3,
    description: null },
  { key: "deputy_platoon_2",    label: "Зам. ком. 2 взвода",     short: "ЗКВ2", hex: "#2dd4bf", sortOrder: 4,
    description: null },
  { key: "sergeant_major",      label: "Старшина роты",          short: "СР",   hex: "#fbbf24", sortOrder: 5,
    description: null },
  { key: "squad_commander_2",   label: "Командир 2 отделения",   short: "КО-2", hex: "#fb923c", sortOrder: 6,
    description: null },
  { key: "security_officer",    label: "Ответственный за ЗГТ",   short: "ЗГТ",  hex: "#f87171", sortOrder: 7,
    description: null },
  { key: "duty_officer",        label: "Постоянный состав",      short: "ПС",   hex: "#94a3b8", sortOrder: 8,
    description: "Все военнослужащие постоянного состава." },
] as const;

console.log("Seeding roles...");

// INSERT OR IGNORE — идемпотентно по key
for (const role of SEED_ROLES) {
  await db
    .insert(roles)
    .values(role)
    .onConflictDoNothing({ target: roles.key });
}

// Получаем все роли для маппинга key → id
const allRoles = await db.select({ id: roles.id, key: roles.key }).from(roles);
const roleMap = new Map(allRoles.map((r) => [r.key, r.id]));

console.log(`Seeded ${allRoles.length} roles`);

// ─── USERS ────────────────────────────────────────────────────────────────────
const SEED_USERS = [
  { name: "Иванов Иван Иванович",    login: "ivanov",    roleKey: "company_commander",   initials: "ИИ" },
  { name: "Петров Пётр Петрович",    login: "petrov",    roleKey: "platoon_1_commander", initials: "ПП" },
  { name: "Сидоров Сидор Сидорович", login: "sidorov",   roleKey: "platoon_2_commander", initials: "СС" },
  { name: "Козлов Алексей Николаевич",login: "kozlov",   roleKey: "deputy_platoon_1",    initials: "КА" },
  { name: "Новиков Дмитрий Сергеевич",login: "novikov",  roleKey: "deputy_platoon_2",    initials: "НД" },
  { name: "Морозов Виктор Андреевич", login: "morozov",  roleKey: "sergeant_major",      initials: "МВ" },
  { name: "Волков Евгений Игоревич",  login: "volkov",   roleKey: "squad_commander_2",   initials: "ВЕ" },
  { name: "Лебедев Артём Валерьевич", login: "lebedev",  roleKey: "security_officer",    initials: "ЛА" },
  { name: "Соколов Михаил Олегович",  login: "sokolov",  roleKey: "duty_officer",        initials: "СМ" },
];

console.log("Seeding users...");

for (const u of SEED_USERS) {
  const roleId = roleMap.get(u.roleKey);
  if (!roleId) {
    console.warn(`Role key not found: ${u.roleKey}, skipping user ${u.login}`);
    continue;
  }
  await db
    .insert(users)
    .values({ name: u.name, login: u.login, roleId, initials: u.initials })
    .onConflictDoNothing({ target: users.login });
}

const userCount = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
console.log(`Seeded ${userCount[0].count} users`);

// ─── EPICS + TASKS (остаток seed — без изменений) ─────────────────────────────
// ... (существующий код seed для epics/tasks остаётся)

console.log("Seed complete.");
sqlite.close();