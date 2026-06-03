import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "@/shared/db/client";
import {
  personnelGroups,
  roles,
  users,
  variableDailyTasks,
  variableDutyAssignments,
  variableLeaveRequests,
  type VariableDailyTaskStatus,
  type VariableDutySlot,
  type VariableLeaveStatus,
  type VariableLeaveType,
} from "@/shared/db/schema";
import type { UserWithMeta } from "@/shared/types";
import type { WorkspaceAccessScope } from "@/shared/lib/access-scope";
import {
  assertDateRange,
  assertDutySlotsComplete,
  canManageVariableSection,
  canWriteVariableProfile,
  isReviewStatus,
  isVariableUser,
  VARIABLE_DUTY_SLOTS,
} from "@/shared/lib/variable-workflows";

export type DbVariableDailyTask = InferSelectModel<typeof variableDailyTasks>;
export type DbVariableLeaveRequest = InferSelectModel<typeof variableLeaveRequests>;
export type DbVariableDutyAssignment = InferSelectModel<typeof variableDutyAssignments>;

export type VariableDailyTaskView = DbVariableDailyTask & { profile: Pick<UserWithMeta, "id" | "name" | "initials"> };
export type VariableLeaveRequestView = DbVariableLeaveRequest & { profile: Pick<UserWithMeta, "id" | "name" | "initials"> };
export type VariableDutyAssignmentView = DbVariableDutyAssignment & { user: Pick<UserWithMeta, "id" | "name" | "initials"> };

export interface VariableSectionData {
  variableUsers: UserWithMeta[];
  dailyTasks: VariableDailyTaskView[];
  leaveRequests: VariableLeaveRequestView[];
  dutyAssignments: VariableDutyAssignmentView[];
  selectedDate: string;
  tomorrowDate: string;
}

async function getUsersWithRoles(): Promise<UserWithMeta[]> {
  const rows = await db
    .select({ user: users, role: roles, personnelGroup: personnelGroups })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(personnelGroups, eq(roles.personnelGroupId, personnelGroups.id))
    .orderBy(users.blockOrder, roles.sortOrder, users.name);

  return rows.map((row) => ({ ...row.user, roleMeta: { ...row.role, personnelGroup: row.personnelGroup } }));
}

export async function getVariableUsers(): Promise<UserWithMeta[]> {
  return (await getUsersWithRoles()).filter(isVariableUser);
}

export async function getVariableSectionData(input: {
  scope: WorkspaceAccessScope;
  selectedDate: string;
  tomorrowDate: string;
}): Promise<VariableSectionData> {
  const variableUsers = await getVariableUsers();
  const profileIds = input.scope.isAdmin
    ? variableUsers.map((user) => user.id)
    : input.scope.profile ? [input.scope.profile.id] : [];

  const [dailyTasks, leaveRequests, dutyAssignments] = await Promise.all([
    listVariableDailyTasks({ scope: input.scope, dateFrom: input.selectedDate, dateTo: input.tomorrowDate }),
    listVariableLeaveRequests({ scope: input.scope, dateFrom: input.selectedDate, dateTo: input.tomorrowDate }),
    listVariableDutyAssignments({ userIds: profileIds, dateFrom: input.selectedDate, dateTo: input.tomorrowDate }),
  ]);

  return {
    variableUsers,
    dailyTasks,
    leaveRequests,
    dutyAssignments,
    selectedDate: input.selectedDate,
    tomorrowDate: input.tomorrowDate,
  };
}

export async function listVariableDailyTasks(input: {
  scope: WorkspaceAccessScope;
  dateFrom: string;
  dateTo: string;
}): Promise<VariableDailyTaskView[]> {
  const profileIds = await getVisibleProfileIds(input.scope);
  if (profileIds.length === 0) return [];
  const rows = await db
    .select({ task: variableDailyTasks, user: users })
    .from(variableDailyTasks)
    .innerJoin(users, eq(variableDailyTasks.profileUserId, users.id))
    .where(and(
      inArray(variableDailyTasks.profileUserId, profileIds),
      gte(variableDailyTasks.taskDate, input.dateFrom),
      lte(variableDailyTasks.taskDate, input.dateTo),
    ))
    .orderBy(desc(variableDailyTasks.taskDate), asc(users.name), asc(variableDailyTasks.createdAt));

  return rows.map((row) => ({ ...row.task, profile: pickUser(row.user) }));
}

export async function createVariableDailyTask(input: {
  scope: WorkspaceAccessScope;
  profileUserId: number;
  taskDate: string;
  title: string;
  description?: string | null;
}): Promise<DbVariableDailyTask> {
  if (!canWriteVariableProfile(input.scope, input.profileUserId)) throw new Error("ACCESS_DENIED");
  await assertProfileIsVariable(input.profileUserId);
  const [task] = await db.insert(variableDailyTasks).values({
    authorUserId: input.scope.session.user.id,
    profileUserId: input.profileUserId,
    taskDate: input.taskDate,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: "todo",
  }).returning();
  return task;
}

export async function updateVariableDailyTask(input: {
  scope: WorkspaceAccessScope;
  id: number;
  title?: string;
  description?: string | null;
  status?: VariableDailyTaskStatus;
}): Promise<DbVariableDailyTask> {
  const before = await getVariableDailyTaskById(input.id);
  if (!before) throw new Error("NOT_FOUND");
  if (!canWriteVariableProfile(input.scope, before.profileUserId)) throw new Error("ACCESS_DENIED");
  const [task] = await db.update(variableDailyTasks).set({
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    updatedAt: new Date().toISOString(),
  }).where(eq(variableDailyTasks.id, input.id)).returning();
  if (!task) throw new Error("NOT_FOUND");
  return task;
}

export async function getVariableDailyTaskById(id: number): Promise<DbVariableDailyTask | null> {
  const [task] = await db.select().from(variableDailyTasks).where(eq(variableDailyTasks.id, id));
  return task ?? null;
}

export async function listVariableLeaveRequests(input: {
  scope: WorkspaceAccessScope;
  dateFrom: string;
  dateTo: string;
}): Promise<VariableLeaveRequestView[]> {
  const profileIds = await getVisibleProfileIds(input.scope);
  if (profileIds.length === 0) return [];
  const rows = await db
    .select({ request: variableLeaveRequests, user: users })
    .from(variableLeaveRequests)
    .innerJoin(users, eq(variableLeaveRequests.profileUserId, users.id))
    .where(and(
      inArray(variableLeaveRequests.profileUserId, profileIds),
      lte(variableLeaveRequests.dateFrom, input.dateTo),
      gte(variableLeaveRequests.dateTo, input.dateFrom),
    ))
    .orderBy(desc(variableLeaveRequests.createdAt));

  return rows.map((row) => ({ ...row.request, profile: pickUser(row.user) }));
}

export async function createVariableLeaveRequest(input: {
  scope: WorkspaceAccessScope;
  profileUserId: number;
  leaveType: VariableLeaveType;
  dateFrom: string;
  dateTo: string;
  comment?: string | null;
}): Promise<DbVariableLeaveRequest> {
  if (!canWriteVariableProfile(input.scope, input.profileUserId)) throw new Error("ACCESS_DENIED");
  assertDateRange(input.dateFrom, input.dateTo);
  await assertProfileIsVariable(input.profileUserId);
  const [request] = await db.insert(variableLeaveRequests).values({
    requesterUserId: input.scope.session.user.id,
    profileUserId: input.profileUserId,
    leaveType: input.leaveType,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    comment: input.comment?.trim() || null,
    status: "pending",
  }).returning();
  return request;
}

export async function reviewVariableLeaveRequest(input: {
  scope: WorkspaceAccessScope;
  id: number;
  status: VariableLeaveStatus;
  comment?: string | null;
}): Promise<DbVariableLeaveRequest> {
  if (!canManageVariableSection(input.scope)) throw new Error("ACCESS_DENIED");
  if (!isReviewStatus(input.status)) throw new Error("STATUS_INVALID");
  const [request] = await db.update(variableLeaveRequests).set({
    status: input.status,
    comment: input.comment?.trim() || null,
    reviewedByUserId: input.scope.session.user.id,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(variableLeaveRequests.id, input.id)).returning();
  if (!request) throw new Error("NOT_FOUND");
  return request;
}

export async function listVariableDutyAssignments(input: {
  userIds?: number[];
  dateFrom: string;
  dateTo: string;
}): Promise<VariableDutyAssignmentView[]> {
  const rows = await db
    .select({ duty: variableDutyAssignments, user: users })
    .from(variableDutyAssignments)
    .innerJoin(users, eq(variableDutyAssignments.userId, users.id))
    .where(and(
      gte(variableDutyAssignments.dutyDate, input.dateFrom),
      lte(variableDutyAssignments.dutyDate, input.dateTo),
      ...(input.userIds?.length ? [inArray(variableDutyAssignments.userId, input.userIds)] : []),
    ))
    .orderBy(desc(variableDutyAssignments.dutyDate), asc(variableDutyAssignments.slot));

  return rows.map((row) => ({ ...row.duty, user: pickUser(row.user) }));
}

export async function upsertVariableDutySchedule(input: {
  scope: WorkspaceAccessScope;
  dutyDate: string;
  slots: Record<VariableDutySlot, number>;
}): Promise<DbVariableDutyAssignment[]> {
  if (!canManageVariableSection(input.scope)) throw new Error("ACCESS_DENIED");
  assertDutySlotsComplete(input.slots);
  const userIds = Object.values(input.slots);
  for (const userId of userIds) await assertProfileIsVariable(userId);

  const updated: DbVariableDutyAssignment[] = [];
  await db.transaction(async (tx) => {
    for (const slot of VARIABLE_DUTY_SLOTS) {
      const userId = input.slots[slot];
      const existing = await tx
        .select()
        .from(variableDutyAssignments)
        .where(and(eq(variableDutyAssignments.dutyDate, input.dutyDate), eq(variableDutyAssignments.slot, slot)));
      if (existing[0]) {
        const [row] = await tx.update(variableDutyAssignments).set({ userId, updatedAt: new Date().toISOString() })
          .where(eq(variableDutyAssignments.id, existing[0].id)).returning();
        updated.push(row);
      } else {
        const [row] = await tx.insert(variableDutyAssignments).values({ dutyDate: input.dutyDate, slot, userId }).returning();
        updated.push(row);
      }
    }
  });
  return updated;
}

function pickUser(user: Pick<UserWithMeta, "id" | "name" | "initials">): Pick<UserWithMeta, "id" | "name" | "initials"> {
  return { id: user.id, name: user.name, initials: user.initials };
}

async function getVisibleProfileIds(scope: WorkspaceAccessScope): Promise<number[]> {
  if (scope.isAdmin) return (await getVariableUsers()).map((user) => user.id);
  return scope.profile ? [scope.profile.id] : [];
}

async function assertProfileIsVariable(profileUserId: number): Promise<void> {
  const [row] = await db
    .select({ user: users, role: roles, personnelGroup: personnelGroups })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(personnelGroups, eq(roles.personnelGroupId, personnelGroups.id))
    .where(eq(users.id, profileUserId));
  if (!row) throw new Error("PROFILE_NOT_FOUND");
  const user: UserWithMeta = { ...row.user, roleMeta: { ...row.role, personnelGroup: row.personnelGroup } };
  if (!isVariableUser(user)) throw new Error("PROFILE_NOT_VARIABLE");
}
