/**
 * @file userRepository.ts — entities/user
 *
 * ИЗМЕНЕНИЯ v2:
 *   - getAllUsers() теперь делает JOIN с roles
 *   - UserWithMeta.roleMeta строится из DbRole (из БД), не из ROLE_META
 *   - Удалён импорт ROLE_META
 */
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/shared/db/client";
import { users, roles } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import type { UserWithMeta, DbRole } from "@/shared/types";

export const USERS_CACHE_TAG = "users";

async function _getAllUsers(): Promise<UserWithMeta[]> {
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

export const getAllUsers = cache(
  unstable_cache(_getAllUsers, ["getAllUsers"], {
    revalidate: 60,
    tags: [USERS_CACHE_TAG],
  })
);

// ─── Утилита для других репозиториев ─────────────────────────────────────────

/**
 * buildUserWithMeta — собирает UserWithMeta из DbUser + DbRole.
 * Используется в epicRepository и taskRepository (вместо ROLE_META lookup).
 */
export function buildUserWithMeta(
  user: { id: number; name: string; login: string; roleId: number; initials: string; createdAt: string },
  role: DbRole
): UserWithMeta {
  return {
    ...user,
    roleMeta: role,
  };
}