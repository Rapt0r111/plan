import { describe, expect, it } from "vitest";
import {
  assertDateRange,
  assertDutySlotsComplete,
  canAccessVariableSection,
  canWriteVariableProfile,
  isReviewStatus,
} from "@/shared/lib/variable-workflows";
import type { WorkspaceAccessScope } from "@/shared/lib/access-scope";

function scope(partial: Partial<WorkspaceAccessScope>): WorkspaceAccessScope {
  return {
    session: { user: { id: "auth-1", role: "member" } },
    profile: null,
    isAdmin: false,
    groupKey: null,
    isVariableRestricted: false,
    ...partial,
  } as WorkspaceAccessScope;
}

describe("variable personnel workflow rules", () => {
  it("allows variable users and admins into the variable section", () => {
    expect(canAccessVariableSection(scope({ groupKey: "variable", isVariableRestricted: true }))).toBe(true);
    expect(canAccessVariableSection(scope({ isAdmin: true }))).toBe(true);
    expect(canAccessVariableSection(scope({ groupKey: "permanent" }))).toBe(false);
  });

  it("lets variable users write only their own profile while admins can write any variable profile", () => {
    expect(canWriteVariableProfile(scope({ groupKey: "variable", profile: { id: 10 } as WorkspaceAccessScope["profile"] }), 10)).toBe(true);
    expect(canWriteVariableProfile(scope({ groupKey: "variable", profile: { id: 10 } as WorkspaceAccessScope["profile"] }), 11)).toBe(false);
    expect(canWriteVariableProfile(scope({ isAdmin: true }), 11)).toBe(true);
  });

  it("requires a complete duty schedule of two orderlies and one duty officer", () => {
    expect(() => assertDutySlotsComplete({ day_orderly_1: 1, day_orderly_2: 2, duty_officer: 3 })).not.toThrow();
    expect(() => assertDutySlotsComplete({ day_orderly_1: 1, duty_officer: 3 })).toThrow("DUTY_SLOTS_INCOMPLETE");
  });

  it("keeps leave review statuses explicit and date ranges valid", () => {
    expect(isReviewStatus("approved")).toBe(true);
    expect(isReviewStatus("rejected")).toBe(true);
    expect(isReviewStatus("pending")).toBe(false);
    expect(() => assertDateRange("2026-06-02", "2026-06-01")).toThrow("DATE_RANGE_INVALID");
  });
});
