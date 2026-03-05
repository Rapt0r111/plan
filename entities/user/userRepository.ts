/**
 * @file userRepository.ts — entities/user
 *
 * React.cache() + unstable_cache — те же принципы что в epicRepository:
 *  - getAllUsers() вызывается и в layout.tsx (сайдбар) и в dashboard/page.tsx
 *  - cache() дедуплицирует в рамках рендер-прохода
 *  - unstable_cache хранит результат между запросами (TTL=60s)
 *
 * Пользователи меняются крайне редко, поэтому TTL выше чем у эпиков.
 * Тег "users" позволит инвалидировать кеш если добавить API управления
 * командой в будущем.
 *
 * ─── ИСПРАВЛЕНИЕ ТИПОВ ───────────────────────────────────────────────────────
 * Проблема: ROLE_META[role].role имеет тип Role (широкий, включает
 *   "security_officer"), а DbUser.role — более узкий DB-enum без него.
 *   UserWithMeta extends DbUser, поэтому roleMeta.role тоже должен быть
 *   DB-enum, иначе TypeScript ругается на несовместимость.
 *
 * Решение: явно переписываем roleMeta.role значением u.role из строки БД.
 *   { ...meta, role: u.role } — тип поля role сужается до DbUser["role"].
 *   Семантически корректно: ключ ROLE_META и u.role — одно и то же значение.
 *
 * Почему не "as UserWithMeta":
 *   Приведение типа скрыло бы проблему; явная перезапись фиксирует её.
 */
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/shared/db/client";
import { users } from "@/shared/db/schema";
import { ROLE_META } from "@/shared/config/roles";
import type { UserWithMeta } from "@/shared/types";

export const USERS_CACHE_TAG = "users";

async function _getAllUsers(): Promise<UserWithMeta[]> {
  const rows = await db.select().from(users).orderBy(users.name);
  return rows.map((u): UserWithMeta => {
    const meta = ROLE_META[u.role as keyof typeof ROLE_META];
    // Переписываем meta.role типом из БД — устраняет несовместимость Role vs DbRole
    return { ...u, roleMeta: { ...meta, role: u.role } };
  });
}

/**
 * getAllUsers — список пользователей с ролевыми метаданными.
 *
 * Кешируется агрессивнее эпиков (TTL=60s): пользователи меняются редко.
 * React.cache устраняет дублирование между layout.tsx и page.tsx.
 */
export const getAllUsers = cache(
  unstable_cache(_getAllUsers, ["getAllUsers"], {
    revalidate: 60,
    tags: [USERS_CACHE_TAG],
  }),
);