import { db } from "@/shared/db/client";
import { personnelGroups, roles } from "@/shared/db/schema";
import { count, eq } from "drizzle-orm";
import type { DbPersonnelGroup } from "@/shared/types";

export const PERSONNEL_GROUPS_CACHE_TAG = "personnel-groups";

export async function getAllPersonnelGroups(options: { includeInactive?: boolean } = {}): Promise<DbPersonnelGroup[]> {
  const rows = await db
    .select()
    .from(personnelGroups)
    .orderBy(personnelGroups.sortOrder, personnelGroups.id);

  return options.includeInactive ? rows : rows.filter((group) => group.isActive);
}

export async function getPersonnelGroupById(id: number): Promise<DbPersonnelGroup | null> {
  const [group] = await db.select().from(personnelGroups).where(eq(personnelGroups.id, id));
  return group ?? null;
}

export async function getPersonnelGroupByKey(key: string): Promise<DbPersonnelGroup | null> {
  const [group] = await db.select().from(personnelGroups).where(eq(personnelGroups.key, key));
  return group ?? null;
}

export async function createPersonnelGroup(
  data: Pick<DbPersonnelGroup, "key" | "label" | "description" | "color" | "sortOrder" | "isActive">,
): Promise<DbPersonnelGroup> {
  const [group] = await db.insert(personnelGroups).values(data).returning();
  return group;
}

export async function updatePersonnelGroup(
  id: number,
  data: Partial<Pick<DbPersonnelGroup, "label" | "description" | "color" | "sortOrder" | "isActive">>,
): Promise<DbPersonnelGroup> {
  const [group] = await db
    .update(personnelGroups)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(personnelGroups.id, id))
    .returning();

  if (!group) throw new Error(`Personnel group ${id} not found`);
  return group;
}

export async function deletePersonnelGroup(id: number): Promise<void> {
  const [{ roleCount }] = await db
    .select({ roleCount: count(roles.id) })
    .from(roles)
    .where(eq(roles.personnelGroupId, id));

  if (roleCount > 0) {
    const err = new Error(`Cannot delete personnel group: ${roleCount} role(s) assigned`);
    (err as Error & { code: string }).code = "PERSONNEL_GROUP_HAS_ROLES";
    throw err;
  }

  await db.delete(personnelGroups).where(eq(personnelGroups.id, id));
}
