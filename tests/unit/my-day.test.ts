import { describe, expect, it } from "vitest";
import {
  buildMyDayAttention,
  buildMyDayStats,
  groupMyDayAttentionBySection,
  summarizeUserAttention,
  type MyDayBoardTask,
  type MyDayOperativeTask,
  type MyDayPersonalPlanItem,
} from "@/shared/lib/my-day";
import { DEFAULT_SLA_POLICY } from "@/shared/lib/management-metrics";

const now = new Date(2026, 4, 30, 10, 0);

function boardTask(partial: Partial<MyDayBoardTask>): MyDayBoardTask {
  return {
    id: partial.id ?? 1,
    title: partial.title ?? "Board task",
    epicId: partial.epicId ?? 1,
    epicTitle: partial.epicTitle ?? "Epic",
    epicColor: partial.epicColor ?? "#8b5cf6",
    status: partial.status ?? "todo",
    priority: partial.priority ?? "medium",
    dueDate: partial.dueDate ?? null,
    updatedAt: partial.updatedAt ?? "2026-05-30T08:00:00.000Z",
    createdAt: partial.createdAt ?? "2026-05-30T08:00:00.000Z",
    completedAt: partial.completedAt ?? null,
    blockedReason: partial.blockedReason ?? null,
    assigneeCount: partial.assigneeCount ?? 1,
    assignees: partial.assignees ?? [{ id: 1, name: "Р ВР Р†Р В°Р Р…", initials: "Р В" }],
  };
}

function operativeTask(partial: Partial<MyDayOperativeTask>): MyDayOperativeTask {
  return {
    id: partial.id ?? 10,
    title: partial.title ?? "Operative",
    description: partial.description ?? null,
    status: partial.status ?? "todo",
    dueDate: partial.dueDate ?? null,
    updatedAt: partial.updatedAt ?? "2026-05-30T08:00:00.000Z",
    createdAt: partial.createdAt ?? "2026-05-30T08:00:00.000Z",
    user: partial.user ?? { id: 1, name: "Р ВР Р†Р В°Р Р…", initials: "Р В" },
  };
}

function planItem(partial: Partial<MyDayPersonalPlanItem>): MyDayPersonalPlanItem {
  return {
    id: partial.id ?? 20,
    weekday: partial.weekday ?? 6,
    title: partial.title ?? "Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р В°",
    startTime: partial.startTime ?? "09:00",
    endTime: partial.endTime ?? "11:00",
    sortOrder: partial.sortOrder ?? 0,
    description: partial.description ?? null,
    color: partial.color ?? "#8b5cf6",
    user: partial.user ?? { id: 1, name: "Р ВР Р†Р В°Р Р…", initials: "Р В" },
  };
}

describe("my day helpers", () => {
  it("collects due, overdue, blocked and current personal-plan signals", () => {
    const attention = buildMyDayAttention({
      boardTasks: [
        boardTask({ id: 1, dueDate: "2026-05-30T18:00:00.000Z" }),
        boardTask({ id: 2, dueDate: "2026-05-29T18:00:00.000Z" }),
        boardTask({ id: 3, status: "blocked", blockedReason: "Р СњР ВµРЎвЂљ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В°" }),
      ],
      operativeTasks: [
        operativeTask({ id: 4, dueDate: "2026-05-30T12:00:00.000Z" }),
      ],
      personalPlanItems: [
        planItem({ id: 5, startTime: "09:00", endTime: "11:00" }),
      ],
      completions: [],
      referenceDate: now,
      policy: DEFAULT_SLA_POLICY,
    });

    expect(attention.map((item) => item.id)).toEqual([2, 5, 4, 1, 3]);
    expect(attention.map((item) => item.sortReason)).toEqual(["overdue", "due_today", "due_today", "due_today", "blocked"]);
    expect(buildMyDayStats(attention)).toMatchObject({
      total: 5,
      overdue: 1,
      blocked: 1,
      dueToday: 3,
    });
  });

  it("sorts high-priority, blocked, stale, due-soon and assigned fallback for the unified work list", () => {
    const attention = buildMyDayAttention({
      boardTasks: [
        boardTask({ id: 1, title: "Assigned fallback", dueDate: null, updatedAt: "2026-05-30T08:00:00.000Z" }),
        boardTask({ id: 2, title: "Blocked", status: "blocked", blockedReason: "Ждем данные" }),
        boardTask({ id: 3, title: "High", priority: "high" }),
        boardTask({ id: 4, title: "Stale", updatedAt: "2026-05-20T08:00:00.000Z" }),
        boardTask({ id: 5, title: "Soon", dueDate: "2026-05-31T06:00:00.000Z" }),
      ],
      operativeTasks: [
        operativeTask({ id: 6, title: "Assigned operative", dueDate: null }),
      ],
      personalPlanItems: [],
      completions: [],
      referenceDate: now,
      policy: DEFAULT_SLA_POLICY,
      includeAssignedFallback: true,
    });

    expect(attention.map((item) => [item.id, item.sortReason])).toEqual([
      [3, "high_priority"],
      [2, "blocked"],
      [4, "stale"],
      [5, "due_soon"],
      [1, "assigned"],
      [6, "assigned"],
    ]);
    expect(groupMyDayAttentionBySection(attention)).toMatchObject({
      urgent: [{ id: 3 }],
      waiting: [{ id: 2 }],
      later: [{ id: 4 }, { id: 5 }, { id: 1 }, { id: 6 }],
    });
  });

  it("summarizes who needs attention for leader view", () => {
    const attention = buildMyDayAttention({
      boardTasks: [
        boardTask({ id: 1, dueDate: "2026-05-29T18:00:00.000Z", assignees: [{ id: 1, name: "Р ВР Р†Р В°Р Р…", initials: "Р В" }] }),
        boardTask({ id: 2, status: "blocked", blockedReason: "Р СњР ВµРЎвЂљ Р СћР вЂ”", assignees: [{ id: 2, name: "Р С’Р Р…Р Р…Р В°", initials: "Р С’" }] }),
        boardTask({ id: 3, dueDate: "2026-05-30T18:00:00.000Z", assignees: [{ id: 1, name: "Р ВР Р†Р В°Р Р…", initials: "Р В" }] }),
      ],
      operativeTasks: [],
      personalPlanItems: [],
      completions: [],
      referenceDate: now,
      policy: DEFAULT_SLA_POLICY,
    });

    const users = summarizeUserAttention(attention);
    expect(users[0]).toMatchObject({ user: { name: "Р ВР Р†Р В°Р Р…" }, overdue: 1, dueToday: 1, total: 2 });
    expect(users[1]).toMatchObject({ user: { name: "Р С’Р Р…Р Р…Р В°" }, blocked: 1, total: 1 });
  });
});
