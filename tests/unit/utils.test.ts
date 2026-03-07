import { describe, it, expect } from "vitest";
import { cn, formatDate, computeProgress } from "@/shared/lib/utils";

describe("cn()", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("resolves Tailwind conflicts (tailwind-merge)", () => {
    // tailwind-merge keeps the last conflicting utility
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});

describe("formatDate()", () => {
  it("returns em-dash for null/undefined", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("formats a valid ISO date string", () => {
    const result = formatDate("2026-01-15T00:00:00.000Z");
    // Should contain the day number
    expect(result).toMatch(/15/);
  });
});

describe("computeProgress()", () => {
  it("returns zeros for empty subtask array", () => {
    expect(computeProgress([])).toEqual({ done: 0, total: 0 });
  });

  it("counts completed subtasks correctly", () => {
    const subtasks = [
      { isCompleted: true },
      { isCompleted: false },
      { isCompleted: true },
    ];
    expect(computeProgress(subtasks)).toEqual({ done: 2, total: 3 });
  });

  it("handles all-done case", () => {
    const subtasks = [{ isCompleted: true }, { isCompleted: true }];
    expect(computeProgress(subtasks)).toEqual({ done: 2, total: 2 });
  });
});
