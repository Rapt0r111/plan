import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
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
  addDateDays,
  assertEditableVariableTaskDate,
  assertDateRange,
  assertDutySlotsComplete,
  assertWorkGroupSlotsComplete,
  canManageVariableSection,
  canWriteVariableProfile,
  getVariableDutyEndDate,
  isReviewStatus,
  isVariableUser,
  VARIABLE_DAILY_DUTY_SLOTS,
  VARIABLE_WORK_GROUP_SLOTS,
} from "@/shared/lib/variable-workflows";

export type DbVariableDailyTask = InferSelectModel<typeof variableDailyTasks>;
export type DbVariableLeaveRequest = InferSelectModel<typeof variableLeaveRequests>;
export type DbVariableDutyAssignment = InferSelectModel<typeof variableDutyAssignments>;
type DbVariableDutyAssignmentWithRange = Omit<DbVariableDutyAssignment, "dateFrom" | "dateTo"> & { dateFrom: string; dateTo: string };

export type VariableDailyTaskView = DbVariableDailyTask & { profile: Pick<UserWithMeta, "id" | "name" | "initials"> };
export type VariableLeaveRequestView = DbVariableLeaveRequest & { profile: Pick<UserWithMeta, "id" | "name" | "initials"> };
export type VariableDutyAssignmentView = DbVariableDutyAssignmentWithRange & { user: Pick<UserWithMeta, "id" | "name" | "initials"> };

export interface VariableSectionData {
  variableUsers: UserWithMeta[];
  dailyTasks: VariableDailyTaskView[];
  deletedDailyTasks: VariableDailyTaskView[];
  leaveRequests: VariableLeaveRequestView[];
  dutyAssignments: VariableDutyAssignmentView[];
  todayDate: string;
  selectedDate: string;
  tomorrowDate: string;
  selectedMonth: string;
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
  todayDate: string;
  selectedDate: string;
  tomorrowDate: string;
  selectedMonth: string;
}): Promise<VariableSectionData> {
  const variableUsers = await getVariableUsers();
  const profileIds = variableUsers.map((user) => user.id);

  const taskDateFrom = [input.todayDate, input.selectedDate, input.tomorrowDate].sort()[0];
  const taskDateTo = [input.todayDate, input.selectedDate, input.tomorrowDate].sort().at(-1) ?? input.tomorrowDate;
  const monthDateFrom = `${input.selectedMonth}-01`;
  const monthDateTo = getMonthEndDate(input.selectedMonth);
  const wideDateFrom = [addDateDays(input.todayDate, -365), input.selectedDate, monthDateFrom].sort()[0];
  const wideDateTo = [addDateDays(input.todayDate, 365), input.selectedDate, input.tomorrowDate, monthDateTo].sort().at(-1) ?? input.tomorrowDate;

  const [dailyTasks, deletedDailyTasks, leaveRequests, dutyAssignments] = await Promise.all([
    listVariableDailyTasks({ scope: input.scope, dateFrom: taskDateFrom, dateTo: taskDateTo }),
    listDeletedVariableDailyTasks({ scope: input.scope, dateFrom: wideDateFrom, dateTo: wideDateTo }),
    listVariableLeaveRequests({ scope: input.scope, dateFrom: wideDateFrom, dateTo: wideDateTo }),
    listVariableDutyAssignments({ userIds: profileIds, dateFrom: wideDateFrom, dateTo: wideDateTo }),
  ]);

  return {
    variableUsers,
    dailyTasks,
    deletedDailyTasks,
    leaveRequests,
    dutyAssignments,
    todayDate: input.todayDate,
    selectedDate: input.selectedDate,
    tomorrowDate: input.tomorrowDate,
    selectedMonth: input.selectedMonth,
  };
}

export async function listVariableDailyTasks(input: {
  scope: WorkspaceAccessScope;
  dateFrom: string;
  dateTo: string;
}): Promise<VariableDailyTaskView[]> {
  const profileIds = await getVisibleProfileIds(input.scope, { allVariableForVariableUsers: true });
  if (profileIds.length === 0) return [];
  const rows = await db
    .select({ task: variableDailyTasks, user: users })
    .from(variableDailyTasks)
    .innerJoin(users, eq(variableDailyTasks.profileUserId, users.id))
    .where(and(
      inArray(variableDailyTasks.profileUserId, profileIds),
      gte(variableDailyTasks.taskDate, input.dateFrom),
      lte(variableDailyTasks.taskDate, input.dateTo),
      isNull(variableDailyTasks.deletedAt),
    ))
    .orderBy(desc(variableDailyTasks.taskDate), asc(users.name), asc(variableDailyTasks.createdAt));

  return rows.map((row) => ({ ...row.task, profile: pickUser(row.user) }));
}

export async function listDeletedVariableDailyTasks(input: {
  scope: WorkspaceAccessScope;
  dateFrom: string;
  dateTo: string;
}): Promise<VariableDailyTaskView[]> {
  const profileIds = await getVisibleProfileIds(input.scope, { allVariableForVariableUsers: true });
  if (profileIds.length === 0) return [];
  const rows = await db
    .select({ task: variableDailyTasks, user: users })
    .from(variableDailyTasks)
    .innerJoin(users, eq(variableDailyTasks.profileUserId, users.id))
    .where(and(
      inArray(variableDailyTasks.profileUserId, profileIds),
      gte(variableDailyTasks.taskDate, input.dateFrom),
      lte(variableDailyTasks.taskDate, input.dateTo),
      isNotNull(variableDailyTasks.deletedAt),
    ))
    .orderBy(desc(variableDailyTasks.deletedAt), desc(variableDailyTasks.taskDate), asc(users.name));

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
  assertEditableVariableTaskDate(input.taskDate);
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
  if (before.deletedAt) throw new Error("TASK_DELETED");
  if (!canWriteVariableProfile(input.scope, before.profileUserId)) throw new Error("ACCESS_DENIED");
  assertEditableVariableTaskDate(before.taskDate);
  const [task] = await db.update(variableDailyTasks).set({
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    updatedAt: new Date().toISOString(),
  }).where(eq(variableDailyTasks.id, input.id)).returning();
  if (!task) throw new Error("NOT_FOUND");
  return task;
}

export async function deleteVariableDailyTask(input: {
  scope: WorkspaceAccessScope;
  id: number;
}): Promise<DbVariableDailyTask> {
  const before = await getVariableDailyTaskById(input.id);
  if (!before) throw new Error("NOT_FOUND");
  if (before.deletedAt) throw new Error("TASK_DELETED");
  if (!canWriteVariableProfile(input.scope, before.profileUserId)) throw new Error("ACCESS_DENIED");
  assertEditableVariableTaskDate(before.taskDate);
  const now = new Date().toISOString();
  const [task] = await db.update(variableDailyTasks).set({
    deletedAt: now,
    deletedByUserId: input.scope.session.user.id,
    updatedAt: now,
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
  departureTime?: string | null;
  arrivalTime?: string | null;
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
    departureTime: input.departureTime?.trim() || null,
    arrivalTime: input.arrivalTime?.trim() || null,
    comment: input.comment?.trim() || null,
    status: "pending",
  }).returning();
  return request;
}

export async function revokeVariableLeaveRequest(input: {
  scope: WorkspaceAccessScope;
  id: number;
  comment?: string | null;
}): Promise<DbVariableLeaveRequest> {
  const before = await getVariableLeaveRequestById(input.id);
  if (!before) throw new Error("NOT_FOUND");
  if (!canManageVariableSection(input.scope) && !canWriteVariableProfile(input.scope, before.profileUserId)) throw new Error("ACCESS_DENIED");
  if (before.status !== "approved") throw new Error("LEAVE_REVOKE_ONLY_APPROVED");
  const now = new Date().toISOString();
  const [request] = await db.update(variableLeaveRequests).set({
    status: "revoked",
    comment: input.comment?.trim() || before.comment,
    reviewedByUserId: input.scope.session.user.id,
    reviewedAt: now,
    updatedAt: now,
  }).where(eq(variableLeaveRequests.id, input.id)).returning();
  if (!request) throw new Error("NOT_FOUND");
  return request;
}

export async function getVariableLeaveRequestById(id: number): Promise<DbVariableLeaveRequest | null> {
  const [request] = await db.select().from(variableLeaveRequests).where(eq(variableLeaveRequests.id, id));
  return request ?? null;
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
      or(
        and(gte(variableDutyAssignments.dutyDate, input.dateFrom), lte(variableDutyAssignments.dutyDate, input.dateTo)),
        and(lte(variableDutyAssignments.dateFrom, input.dateTo), gte(variableDutyAssignments.dateTo, input.dateFrom)),
      ),
      ...(input.userIds?.length ? [inArray(variableDutyAssignments.userId, input.userIds)] : []),
    ))
    .orderBy(asc(variableDutyAssignments.dutyDate), asc(variableDutyAssignments.slot));

  return rows.map((row) => normalizeDutyAssignment(row.duty, row.user));
}

export async function upsertVariableDutySchedule(input: {
  scope: WorkspaceAccessScope;
  dutyDate: string;
  slots: Partial<Record<VariableDutySlot, number>>;
}): Promise<DbVariableDutyAssignment[]> {
  if (!canManageVariableSection(input.scope)) throw new Error("ACCESS_DENIED");
  assertDutySlotsComplete(input.slots);
  return upsertDutySlots({
    dateFrom: input.dutyDate,
    dateTo: getVariableDutyEndDate(input.dutyDate),
    slots: input.slots,
    slotKeys: VARIABLE_DAILY_DUTY_SLOTS,
  });
}

export async function upsertVariableWorkGroupSchedule(input: {
  scope: WorkspaceAccessScope;
  dateFrom: string;
  dateTo: string;
  slots: Partial<Record<VariableDutySlot, number>>;
}): Promise<DbVariableDutyAssignment[]> {
  if (!canManageVariableSection(input.scope)) throw new Error("ACCESS_DENIED");
  assertDateRange(input.dateFrom, input.dateTo);
  assertWorkGroupSlotsComplete(input.slots);
  return upsertDutySlots({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    slots: input.slots,
    slotKeys: VARIABLE_WORK_GROUP_SLOTS,
  });
}

function pickUser(user: Pick<UserWithMeta, "id" | "name" | "initials">): Pick<UserWithMeta, "id" | "name" | "initials"> {
  return { id: user.id, name: user.name, initials: user.initials };
}

function normalizeDutyAssignment(duty: DbVariableDutyAssignment, user: Pick<UserWithMeta, "id" | "name" | "initials">): VariableDutyAssignmentView {
  const dateFrom = duty.dateFrom ?? duty.dutyDate;
  const dateTo = duty.dateTo ?? getVariableDutyEndDate(duty.dutyDate);
  return { ...duty, dateFrom, dateTo, user: pickUser(user) };
}

async function upsertDutySlots(input: {
  dateFrom: string;
  dateTo: string;
  slots: Partial<Record<VariableDutySlot, number>>;
  slotKeys: VariableDutySlot[];
}): Promise<DbVariableDutyAssignment[]> {
  const userIds = input.slotKeys.map((slot) => input.slots[slot]).filter((userId): userId is number => Boolean(userId));
  for (const userId of userIds) await assertProfileIsVariable(userId);

  const updated: DbVariableDutyAssignment[] = [];
  await db.transaction(async (tx) => {
    for (const slot of input.slotKeys) {
      const userId = input.slots[slot];
      if (!userId) throw new Error("DUTY_SLOTS_INCOMPLETE");
      const existing = await tx
        .select()
        .from(variableDutyAssignments)
        .where(and(eq(variableDutyAssignments.dutyDate, input.dateFrom), eq(variableDutyAssignments.slot, slot)));
      const values = { userId, dateFrom: input.dateFrom, dateTo: input.dateTo, updatedAt: new Date().toISOString() };
      if (existing[0]) {
        const [row] = await tx.update(variableDutyAssignments).set(values)
          .where(eq(variableDutyAssignments.id, existing[0].id)).returning();
        updated.push(row);
      } else {
        const [row] = await tx.insert(variableDutyAssignments).values({
          dutyDate: input.dateFrom,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          slot,
          userId,
        }).returning();
        updated.push(row);
      }
    }
  });
  return updated;
}

async function getVisibleProfileIds(scope: WorkspaceAccessScope, options?: { allVariableForVariableUsers?: boolean }): Promise<number[]> {
  if (scope.isAdmin || (options?.allVariableForVariableUsers && scope.groupKey === "variable")) return (await getVariableUsers()).map((user) => user.id);
  return scope.profile ? [scope.profile.id] : [];
}

function getMonthEndDate(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
