import type { WorkspaceAccessScope } from "@/shared/lib/access-scope";
import type { UserWithMeta } from "@/shared/types";
import { getUserPersonnelGroupKey } from "@/shared/lib/personnel-composition";
import type { VariableDutySlot, VariableLeaveStatus } from "@/shared/db/schema";

export const VARIABLE_DUTY_SLOTS: VariableDutySlot[] = ["day_orderly_1", "day_orderly_2", "duty_officer"];

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
  const missing = VARIABLE_DUTY_SLOTS.filter((slot) => !slots[slot]);
  if (missing.length > 0) throw new Error("DUTY_SLOTS_INCOMPLETE");
}

export function isReviewStatus(status: VariableLeaveStatus): boolean {
  return status === "approved" || status === "rejected";
}
