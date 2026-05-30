import { describe, expect, it } from "vitest";
import {
  getBlockedReasonValidationError,
  normalizeBlockedReason,
  normalizeTaskStatusPatch,
} from "@/shared/lib/task-status-rules";

describe("task status rules", () => {
  it("requires a short reason when a task becomes blocked", () => {
    expect(getBlockedReasonValidationError({ nextStatus: "blocked", nextBlockedReason: "" })).toBeTruthy();
    expect(getBlockedReasonValidationError({ nextStatus: "blocked", nextBlockedReason: "Ждём ответ подрядчика" })).toBeNull();
  });

  it("allows editing an already blocked task when it already has a reason", () => {
    expect(getBlockedReasonValidationError({
      currentStatus: "blocked",
      currentBlockedReason: "Нет доступа к объекту",
    })).toBeNull();
  });

  it("clears blocked reason when leaving blocked status", () => {
    expect(normalizeTaskStatusPatch({ status: "in_progress", blockedReason: "old" })).toEqual({
      status: "in_progress",
      blockedReason: null,
    });
  });

  it("trims blocked reason values", () => {
    expect(normalizeBlockedReason("  причина  ")).toBe("причина");
    expect(normalizeTaskStatusPatch({ status: "blocked", blockedReason: "  нет ТЗ  " })).toEqual({
      status: "blocked",
      blockedReason: "нет ТЗ",
    });
  });
});
