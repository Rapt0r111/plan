/**
 * @file roleRepository.ts — entities/role
 *
 * ИСПРАВЛЕНИЕ v4 — удалены cacheTag() / cacheLife():
 *   Вызовы cacheTag/cacheLife требуют experimental.dynamicIO: true.
 *   Для локального SQLite этот уровень кеширования не нужен.
 */

import { db } from "@/shared/db/client";
import { personnelGroups, roles, users } from "@/shared/db/schema";
import { eq, count } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import type { DbRole as RoleWithGroup } from "@/shared/types";

export type DbRole = RoleWithGroup;
export type NewRole = InferInsertModel<typeof roles>;

export const ROLES_CACHE_TAG = "roles";

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllRoles(): Promise<DbRole[]> {
  const rows = await db
    .select({ role: roles, personnelGroup: personnelGroups })
    .from(roles)
    .leftJoin(personnelGroups, eq(roles.personnelGroupId, personnelGroups.id))
    .orderBy(personnelGroups.sortOrder, roles.sortOrder, roles.id);

  return rows.map((row) => ({ ...row.role, personnelGroup: row.personnelGroup }));
}

export async function getRoleById(id: number): Promise<DbRole | null> {
  const [row] = await db
    .select({ role: roles, personnelGroup: personnelGroups })
    .from(roles)
    .leftJoin(personnelGroups, eq(roles.personnelGroupId, personnelGroups.id))
    .where(eq(roles.id, id));
  return row ? { ...row.role, personnelGroup: row.personnelGroup } : null;
}

export async function getRoleByKey(key: string): Promise<DbRole | null> {
  const [row] = await db
    .select({ role: roles, personnelGroup: personnelGroups })
    .from(roles)
    .leftJoin(personnelGroups, eq(roles.personnelGroupId, personnelGroups.id))
    .where(eq(roles.key, key));
  return row ? { ...row.role, personnelGroup: row.personnelGroup } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

export async function createRole(
  data: Omit<NewRole, "id" | "createdAt" | "updatedAt">
): Promise<DbRole> {
  const [created] = await db
    .insert(roles)
    .values(data)
    .returning({ id: roles.id });
  const role = await getRoleById(created.id);
  if (!role) throw new Error("Created role not found");
  return role;
}

export async function updateRole(
  id: number,
  data: Partial<Omit<NewRole, "id" | "createdAt" | "updatedAt">>
): Promise<DbRole> {
  const [updated] = await db
    .update(roles)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(roles.id, id))
    .returning({ id: roles.id });
  if (!updated) throw new Error(`Role ${id} not found`);
  const role = await getRoleById(updated.id);
  if (!role) throw new Error(`Role ${id} not found`);
  return role;
}

/**
 * deleteRole — защита: нельзя удалить роль, к которой привязаны пользователи.
 */
export async function deleteRole(id: number): Promise<void> {
  const [{ userCount }] = await db
    .select({ userCount: count(users.id) })
    .from(users)
    .where(eq(users.roleId, id));

  if (userCount > 0) {
    const err = new Error(`Cannot delete role: ${userCount} user(s) assigned`);
    (err as Error & { code: string }).code = "ROLE_HAS_USERS";
    throw err;
  }

  await db.delete(roles).where(eq(roles.id, id));
}
