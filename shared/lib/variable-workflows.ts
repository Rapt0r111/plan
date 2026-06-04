import type { WorkspaceAccessScope } from "@/shared/lib/access-scope";
import type { UserWithMeta } from "@/shared/types";
import { getUserPersonnelGroupKey } from "@/shared/lib/personnel-composition";
import type { VariableDutySlot, VariableLeaveStatus } from "@/shared/db/schema";

export const VARIABLE_DAILY_DUTY_SLOTS: VariableDutySlot[] = ["day_orderly_1", "day_orderly_2", "duty_officer"];
export const VARIABLE_WORK_GROUP_SLOTS: VariableDutySlot[] = ["day_rg", "night_rg", "info_rg"];
export const VARIABLE_DUTY_SLOTS: VariableDutySlot[] = [...VARIABLE_DAILY_DUTY_SLOTS, ...VARIABLE_WORK_GROUP_SLOTS];

export function canAccessVariableSection(scope: WorkspaceAccessScope): boolean {
  return scope.isAdmin || scope.groupKey === "variable";
}

export function assertVariableSectionAccess(scope: WorkspaceAccessScope): void {
  if (!canAccessVariableSection(scope)) throw new Error("ACCESS_DENIED");
}

export function isVariableUser(user: UserWithMeta): boolean {
  return getUserPersonnelGroupKey(user) === "variable";
}

export function canManageVariableSection(scope: WorkspaceAccessScope): boolean {
  return scope.isAdmin;
}

export function canWriteVariableProfile(scope: WorkspaceAccessScope, profileUserId: number): boolean {
  return scope.isAdmin || (scope.groupKey === "variable" && scope.profile?.id === profileUserId);
}

export function getTomorrowKey(referenceDate = new Date()): string {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() + 1);
  return toDateKey(date);
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function assertDateRange(dateFrom: string, dateTo: string): void {
  if (dateFrom > dateTo) throw new Error("DATE_RANGE_INVALID");
}

export function assertDutySlotsComplete(slots: Partial<Record<VariableDutySlot, number | null>>): void {
  const missing = VARIABLE_DAILY_DUTY_SLOTS.filter((slot) => !slots[slot]);
  if (missing.length > 0) throw new Error("DUTY_SLOTS_INCOMPLETE");
}

export function assertWorkGroupSlotsComplete(slots: Partial<Record<VariableDutySlot, number | null>>): void {
  const missing = VARIABLE_WORK_GROUP_SLOTS.filter((slot) => !slots[slot]);
  if (missing.length > 0) throw new Error("WORK_GROUP_SLOTS_INCOMPLETE");
}

export function isReviewStatus(status: VariableLeaveStatus): boolean {
  return status === "approved" || status === "rejected";
}

export function isRevokedStatus(status: VariableLeaveStatus): boolean {
  return status === "revoked";
}

export function assertEditableVariableTaskDate(taskDate: string, todayDate = toDateKey(new Date())): void {
  if (taskDate < todayDate) throw new Error("TASK_DATE_PAST_LOCKED");
}

export function addDateDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function getVariableDutyEndDate(dateFrom: string): string {
  return addDateDays(dateFrom, 1);
}

export function getLeaveBucket(request: { dateFrom: string; dateTo: string }, todayDate = toDateKey(new Date())): "future" | "past" | "active" {
  if (request.dateTo < todayDate) return "past";
  if (request.dateFrom > todayDate) return "future";
  return "active";
}

export function isWithinNextThirtyDays(dateFrom: string, todayDate = toDateKey(new Date())): boolean {
  const end = addDateDays(todayDate, 29);
  return dateFrom >= todayDate && dateFrom <= end;
}
