/**
 * @file userRepository.ts — entities/user
 *
 * РЕФАКТОРИНГ v2 — Next.js 16:
 *   БЫЛО: cache(unstable_cache(...)) — двойная обёртка, устаревший API
 *   СТАЛО: директива 'use cache' + cacheTag() + cacheLife()
 *
 *   getAllUsers() — 'use cache', TTL 60 секунд, tag: "users"
 *
 *   Остальные функции (WRITE) кеш не используют — без изменений.
 */

"use cache";

import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/shared/db/client";
import { users, roles } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import type { UserWithMeta, DbUser, DbRole } from "@/shared/types";

export const USERS_CACHE_TAG = "users";

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<UserWithMeta[]> {
  "use cache";
  cacheTag(USERS_CACHE_TAG);
  cacheLife({ revalidate: 60 });

  const rows = await db
    .select({
      id:        users.id,
      name:      users.name,
      login:     users.login,
      roleId:    users.roleId,
      initials:  users.initials,
      createdAt: users.createdAt,
      role: {
        id:          roles.id,
        key:         roles.key,
        label:       roles.label,
        short:       roles.short,
        hex:         roles.hex,
        description: roles.description,
        sortOrder:   roles.sortOrder,
        createdAt:   roles.createdAt,
        updatedAt:   roles.updatedAt,
      },
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(users.name);

  return rows.map((r) => ({
    id:        r.id,
    name:      r.name,
    login:     r.login,
    roleId:    r.roleId,
    initials:  r.initials,
    createdAt: r.createdAt,
    roleMeta:  r.role,
  }));
}

export function buildUserWithMeta(
  user: { id: number; name: string; login: string; roleId: number; initials: string; createdAt: string },
  role: DbRole
): UserWithMeta {
  return { ...user, roleMeta: role };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE — кеш не применяется
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