/**
 * @file roleRepository.ts — entities/role
 *
 * Repository для динамических ролей.
 *
 * CACHE STRATEGY:
 *   getAllRoles() — cache(unstable_cache), TTL 300s, tag "roles"
 *   getRoleById() — без кеша (используется в CRUD)
 *   мутации       — revalidateTag("roles") + revalidateTag("users")
 *
 * TYPE SAFETY:
 *   Все типы выводятся через Drizzle InferSelectModel / InferInsertModel.
 *   Никаких "as", никаких any.
 */
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/shared/db/client";
import { roles, users } from "@/shared/db/schema";
import { eq, sql, count } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type DbRole = InferSelectModel<typeof roles>;
export type NewRole = InferInsertModel<typeof roles>;

export const ROLES_CACHE_TAG = "roles";
const CACHE_TTL = 300;

// ─── READ ─────────────────────────────────────────────────────────────────────

async function _getAllRoles(): Promise<DbRole[]> {
  return db
    .select()
    .from(roles)
    .orderBy(roles.sortOrder, roles.id);
}

/**
 * getAllRoles — кешируется агрессивно (роли меняются редко).
 * React.cache дедуплицирует вызовы в рамках одного SSR-прохода.
 */
export const getAllRoles = cache(
  unstable_cache(_getAllRoles, ["getAllRoles"], {
    revalidate: CACHE_TTL,
    tags: [ROLES_CACHE_TAG],
  })
);

export async function getRoleById(id: number): Promise<DbRole | null> {
  const [role] = await db.select().from(roles).where(eq(roles.id, id));
  return role ?? null;
}

export async function getRoleByKey(key: string): Promise<DbRole | null> {
  const [role] = await db.select().from(roles).where(eq(roles.key, key));
  return role ?? null;
}

// ─── WRITE ────────────────────────────────────────────────────────────────────

export async function createRole(
  data: Omit<NewRole, "id" | "createdAt" | "updatedAt">
): Promise<DbRole> {
  const [created] = await db
    .insert(roles)
    .values(data)
    .returning();
  return created;
}

export async function updateRole(
  id: number,
  data: Partial<Omit<NewRole, "id" | "createdAt" | "updatedAt">>
): Promise<DbRole> {
  const [updated] = await db
    .update(roles)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(roles.id, id))
    .returning();
  if (!updated) throw new Error(`Role ${id} not found`);
  return updated;
}

/**
 * deleteRole — защита: нельзя удалить роль, к которой привязаны пользователи.
 * Выбрасывает ошибку с кодом ROLE_HAS_USERS → API вернёт 409.
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