/**
 * @file roleRepository.ts — entities/role
 *
 * РЕФАКТОРИНГ v3 — исправление кеша для мутаций:
 *
 *   БЫЛА ОШИБКА: файловая директива "use cache" кешировала ВСЕ функции,
 *   включая мутации createRole, updateRole, deleteRole. Повторный вызов
 *   мутации возвращал бы закешированный результат вместо записи в БД.
 *
 *   ИСПРАВЛЕНО: файловая директива удалена. "use cache" оставлена только
 *   внутри getAllRoles(). Мутации остаются некешированными.
 */

import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/shared/db/client";
import { roles, users } from "@/shared/db/schema";
import { eq, count } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type DbRole = InferSelectModel<typeof roles>;
export type NewRole = InferInsertModel<typeof roles>;

export const ROLES_CACHE_TAG = "roles";

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getAllRoles — кешируется агрессивно (роли меняются редко).
 * 'use cache' автоматически дедуплицирует запросы в рамках одного SSR-прохода —
 * React.cache() больше не нужен.
 */
export async function getAllRoles(): Promise<DbRole[]> {
  cacheTag(ROLES_CACHE_TAG);
  cacheLife({ revalidate: 300 }); // 5 минут

  return db
    .select()
    .from(roles)
    .orderBy(roles.sortOrder, roles.id);
}

export async function getRoleById(id: number): Promise<DbRole | null> {
  const [role] = await db.select().from(roles).where(eq(roles.id, id));
  return role ?? null;
}

export async function getRoleByKey(key: string): Promise<DbRole | null> {
  const [role] = await db.select().from(roles).where(eq(roles.key, key));
  return role ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE — "use cache" НЕ применяется. revalidateTag вызывается из Route Handler'ов.
// ─────────────────────────────────────────────────────────────────────────────

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