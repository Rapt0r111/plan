/**
 * @file userRepository.ts — entities/user
 *
 * ИСПРАВЛЕНИЕ v4 — удалены cacheTag() / cacheLife():
 *   Вызовы cacheTag/cacheLife требуют experimental.dynamicIO: true.
 *   Для локального SQLite этот уровень кеширования не нужен.
 */

import { db } from "@/shared/db/client";
import { users, roles } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import type { UserWithMeta, DbUser, DbRole } from "@/shared/types";

export const USERS_CACHE_TAG = "users";

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<UserWithMeta[]> {
  const rows = await db
    .select({
      user: users, // Выбирает все поля (id, name, login, initials, blockOrder, и т.д.)
      role: roles,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(users.name);

  return rows.map((r) => ({
    ...r.user,       // Разворачиваем все поля пользователя (включая blockOrder)
    roleMeta: r.role,
  }));
}

export function buildUserWithMeta(
  user: DbUser, role: DbRole
): UserWithMeta {
  return { ...user, roleMeta: role };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

function generateInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export async function createUser(data: {
  name: string;
  login: string;
  roleId: number;
  initials?: string;
}): Promise<DbUser> {
  const initials = data.initials?.trim() || generateInitials(data.name);
  const [row] = await db
    .insert(users)
    .values({ name: data.name.trim(), login: data.login.trim(), roleId: data.roleId, initials })
    .returning();
  return row;
}

export async function updateUser(
  id: number,
  data: Partial<{ name: string; login: string; roleId: number; initials: string }>
): Promise<DbUser> {
  const patch: typeof data = { ...data };
  if (data.name && !data.initials) {
    patch.initials = generateInitials(data.name);
  }
  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  if (!row) throw new Error(`User ${id} not found`);
  return row;
}

export async function deleteUser(id: number): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

export async function getUserById(id: number): Promise<DbUser | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ?? null;
}