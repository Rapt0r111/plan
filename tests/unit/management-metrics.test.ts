import { describe, expect, it } from "vitest";
import {
  classifyTaskRisk,
  summarizeTaskRisks,
  type ManagementTaskLike,
} from "@/shared/lib/management-metrics";

const now = new Date("2026-05-26T12:00:00.000Z");

function task(partial: Partial<ManagementTaskLike>): ManagementTaskLike {
  return {
    id: partial.id ?? 1,
    title: partial.title ?? "Task",
    status: partial.status ?? "todo",
    priority: partial.priority ?? "medium",
    dueDate: partial.dueDate ?? null,
    updatedAt: partial.updatedAt ?? "2026-05-26T10:00:00.000Z",
    createdAt: partial.createdAt ?? "2026-05-26T09:00:00.000Z",
    completedAt: partial.completedAt ?? null,
    blockedReason: partial.blockedReason ?? null,
    assigneeCount: partial.assigneeCount ?? 1,
  };
}

describe("management metrics", () => {
  it("prioritizes terminal and operational risk states", () => {
    expect(classifyTaskRisk(task({ status: "done" }), now)).toBe("completed");
    expect(classifyTaskRisk(task({ status: "blocked" }), now)).toBe("blocked");
    expect(classifyTaskRisk(task({ assigneeCount: 0 }), now)).toBe("unassigned");
  });

  it("detects due today, overdue, stale, and high-priority risk", () => {
    expect(classifyTaskRisk(task({ dueDate: "2026-05-26T18:00:00.000Z" }), now)).toBe("due_today");
    expect(classifyTaskRisk(task({ dueDate: "2026-05-26T08:00:00.000Z" }), now)).toBe("overdue");
    expect(classifyTaskRisk(task({ updatedAt: "2026-05-20T12:00:00.000Z" }), now)).toBe("stale");
    expect(classifyTaskRisk(task({ priority: "high" }), now)).toBe("at_risk");
  });

  it("summarizes portfolio control counters", () => {
    const summary = summarizeTaskRisks([
      task({ id: 1, status: "done" }),
      task({ id: 2, dueDate: "2026-05-25T12:00:00.000Z" }),
      task({ id: 3, assigneeCount: 0 }),
      task({ id: 4, priority: "low" }),
    ], now);

    expect(summary.total).toBe(4);
    expect(summary.completed).toBe(1);
    expect(summary.completionRate).toBe(25);
    expect(summary.controlAttention).toBe(2);
    expect(summary.counters.overdue).toBe(1);
    expect(summary.counters.unassigned).toBe(1);
  });
});
