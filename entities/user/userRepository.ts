import { db } from "@/shared/db/client";
import { users } from "@/shared/db/schema";
import { ROLE_META } from "@/shared/config/roles";
import type { UserWithMeta } from "@/shared/types";

export async function getAllUsers(): Promise<UserWithMeta[]> {
  const rows = await db.select().from(users).orderBy(users.name);
  return rows.map((u) => ({ ...u, roleMeta: ROLE_META[u.role] }));
}