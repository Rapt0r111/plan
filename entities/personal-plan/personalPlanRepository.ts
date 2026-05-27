import { and, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "@/shared/db/client";
import {
  personalPlanCompletions,
  personalPlanItems,
  personnelGroups,
  roles,
  users,
} from "@/shared/db/schema";
import type { UserWithMeta } from "@/shared/types";
import { filterUsersByComposition } from "@/shared/lib/personnel-composition";
import {
  getCurrentWeekDates,
  getPlanOccurrenceDate,
  sortPersonalPlanItems,
} from "@/shared/lib/personal-plan";

export type DbPersonalPlanItem = InferSelectModel<typeof personalPlanItems>;
export type DbPersonalPlanCompletion = InferSelectModel<typeof personalPlanCompletions>;

export interface PersonalPlanUserBlock {
  user: UserWithMeta;
  items: DbPersonalPlanItem[];
}

export interface PersonalPlanData {
  users: PersonalPlanUserBlock[];
  completions: DbPersonalPlanCompletion[];
  weekDates: ReturnType<typeof getCurrentWeekDates>;
}

export interface CreatePersonalPlanItemInput {
  userId: number;
  weekday: number;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  color?: string;
  sortOrder?: number;
}

export interface UpdatePersonalPlanItemInput {
  userId?: number;
  weekday?: number;
  title?: string;
  description?: string | null;
  startTime?: string;
  endTime?: string;
  color?: string;
  sortOrder?: number;
}

async function getAllUsersWithRoles(): Promise<UserWithMeta[]> {
  const rows = await db
    .select({
      user: users,
      role: roles,
      personnelGroup: personnelGroups,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(personnelGroups, eq(roles.personnelGroupId, personnelGroups.id))
    .orderBy(users.blockOrder, roles.sortOrder, users.name);

  return rows.map((row) => ({ ...row.user, roleMeta: { ...row.role, personnelGroup: row.personnelGroup } }));
}

export async function getPermanentUsers(): Promise<UserWithMeta[]> {
  return filterUsersByComposition(await getAllUsersWithRoles(), "permanent");
}

export async function getPersonalPlanData(referenceDate = new Date()): Promise<PersonalPlanData> {
  const permanentUsers = await getPermanentUsers();
  const weekDates = getCurrentWeekDates(referenceDate);

  if (permanentUsers.length === 0) {
    return { users: [], completions: [], weekDates };
  }

  const userIds = permanentUsers.map((user) => user.id);
  const items = await db
    .select()
    .from(personalPlanItems)
    .where(inArray(personalPlanItems.userId, userIds));

  const sortedItems = sortPersonalPlanItems(items);
  const itemIds = sortedItems.map((item) => item.id);
  const completions = itemIds.length
    ? await db
      .select()
      .from(personalPlanCompletions)
      .where(
        and(
          inArray(personalPlanCompletions.itemId, itemIds),
          inArray(personalPlanCompletions.date, weekDates.map((day) => day.isoDate)),
        )
      )
    : [];

  const itemsByUser = new Map<number, DbPersonalPlanItem[]>();
  for (const item of sortedItems) {
    const bucket = itemsByUser.get(item.userId) ?? [];
    bucket.push(item);
    itemsByUser.set(item.userId, bucket);
  }

  return {
    users: permanentUsers.map((user) => ({
      user,
      items: itemsByUser.get(user.id) ?? [],
    })),
    completions,
    weekDates,
  };
}

export async function getPersonalPlanItemById(id: number): Promise<DbPersonalPlanItem | null> {
  const [item] = await db.select().from(personalPlanItems).where(eq(personalPlanItems.id, id));
  return item ?? null;
}

export async function createPersonalPlanItem(input: CreatePersonalPlanItemInput): Promise<DbPersonalPlanItem> {
  const sortOrder = input.sortOrder ?? await getNextSortOrder(input.userId, input.weekday);

  const [item] = await db
    .insert(personalPlanItems)
    .values({
      userId: input.userId,
      weekday: input.weekday,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      startTime: input.startTime,
      endTime: input.endTime,
      color: input.color ?? "#8b5cf6",
      sortOrder,
    })
    .returning();

  return item;
}

export async function updatePersonalPlanItem(
  id: number,
  input: UpdatePersonalPlanItemInput,
): Promise<DbPersonalPlanItem> {
  const patch = {
    ...input,
    ...(input.title !== undefined && { title: input.title.trim() }),
    ...(input.description !== undefined && { description: input.description?.trim() || null }),
    updatedAt: new Date().toISOString(),
  };

  const [item] = await db
    .update(personalPlanItems)
    .set(patch)
    .where(eq(personalPlanItems.id, id))
    .returning();

  if (!item) throw new Error(`Personal plan item ${id} not found`);
  return item;
}

export async function deletePersonalPlanItem(id: number): Promise<DbPersonalPlanItem | null> {
  const [before] = await db.select().from(personalPlanItems).where(eq(personalPlanItems.id, id));
  if (!before) return null;
  await db.delete(personalPlanItems).where(eq(personalPlanItems.id, id));
  return before;
}

export async function setPersonalPlanCompletion(input: {
  itemId: number;
  date?: string;
  completed: boolean;
  completedByUserId?: string | null;
}): Promise<DbPersonalPlanCompletion | null> {
  const item = await getPersonalPlanItemById(input.itemId);
  if (!item) throw new Error(`Personal plan item ${input.itemId} not found`);

  const date = input.date ?? getPlanOccurrenceDate(item.weekday);

  if (!input.completed) {
    await db
      .delete(personalPlanCompletions)
      .where(and(
        eq(personalPlanCompletions.itemId, input.itemId),
        eq(personalPlanCompletions.date, date),
      ));
    return null;
  }

  const existing = await db
    .select()
    .from(personalPlanCompletions)
    .where(and(
      eq(personalPlanCompletions.itemId, input.itemId),
      eq(personalPlanCompletions.date, date),
    ));

  if (existing[0]) return existing[0];

  const [completion] = await db
    .insert(personalPlanCompletions)
    .values({
      itemId: input.itemId,
      date,
      completedByUserId: input.completedByUserId ?? null,
    })
    .returning();

  return completion;
}

async function getNextSortOrder(userId: number, weekday: number): Promise<number> {
  const items = await db
    .select({ sortOrder: personalPlanItems.sortOrder })
    .from(personalPlanItems)
    .where(and(
      eq(personalPlanItems.userId, userId),
      eq(personalPlanItems.weekday, weekday),
    ));

  return items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
}
