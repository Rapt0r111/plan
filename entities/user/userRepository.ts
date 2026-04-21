/**
 * @file userRepository.ts — entities/user
 *
 * ИСПРАВЛЕНИЕ v5 — автоматическое назначение blockOrder:
 *   При создании пользователя вычисляется MAX(blockOrder) + 1,
 *   чтобы новые пользователи всегда оказывались в конце списка.
 */

import { db } from "@/shared/db/client";
import { users, roles } from "@/shared/db/schema";
import { eq, max } from "drizzle-orm"; // Добавлен импорт max
import type { UserWithMeta, DbUser, DbRole } from "@/shared/types";

export const USERS_CACHE_TAG = "users";

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<UserWithMeta[]> {
  const rows = await db
    .select({
      user: users,
      role: roles,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(users.name);

  return rows.map((r) => ({
    ...r.user,
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

  // 1. Находим текущий максимальный blockOrder
  const [result] = await db
    .select({ maxOrder: max(users.blockOrder) })
    .from(users);
  
  // 2. Если пользователей нет, начинаем с 1, иначе max + 1
  const nextOrder = (result?.maxOrder ?? 0) + 1;
  
  const [row] = await db
    .insert(users)
    .values({ 
      name: data.name.trim(), 
      login: data.login.trim(), 
      roleId: data.roleId, 
      initials,
      blockOrder: nextOrder // Явно задаем порядок
    })
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