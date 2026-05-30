import { describe, expect, it } from "vitest";
import {
  buildMyDayAttention,
  buildMyDayStats,
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
    assignees: partial.assignees ?? [{ id: 1, name: "Иван", initials: "И" }],
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
    user: partial.user ?? { id: 1, name: "Иван", initials: "И" },
  };
}

function planItem(partial: Partial<MyDayPersonalPlanItem>): MyDayPersonalPlanItem {
  return {
    id: partial.id ?? 20,
    weekday: partial.weekday ?? 6,
    title: partial.title ?? "Проверка",
    startTime: partial.startTime ?? "09:00",
    endTime: partial.endTime ?? "11:00",
    sortOrder: partial.sortOrder ?? 0,
    description: partial.description ?? null,
    color: partial.color ?? "#8b5cf6",
    user: partial.user ?? { id: 1, name: "Иван", initials: "И" },
  };
}

describe("my day helpers", () => {
  it("collects due, overdue, blocked and current personal-plan signals", () => {
    const attention = buildMyDayAttention({
      boardTasks: [
        boardTask({ id: 1, dueDate: "2026-05-30T18:00:00.000Z" }),
        boardTask({ id: 2, dueDate: "2026-05-29T18:00:00.000Z" }),
        boardTask({ id: 3, status: "blocked", blockedReason: "Нет доступа" }),
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

    expect(attention.map((item) => item.id)).toEqual([2, 3, 5, 4, 1]);
    expect(buildMyDayStats(attention)).toMatchObject({
      total: 5,
      overdue: 1,
      blocked: 1,
      dueToday: 3,
    });
  });

  it("summarizes who needs attention for leader view", () => {
    const attention = buildMyDayAttention({
      boardTasks: [
        boardTask({ id: 1, dueDate: "2026-05-29T18:00:00.000Z", assignees: [{ id: 1, name: "Иван", initials: "И" }] }),
        boardTask({ id: 2, status: "blocked", blockedReason: "Нет ТЗ", assignees: [{ id: 2, name: "Анна", initials: "А" }] }),
        boardTask({ id: 3, dueDate: "2026-05-30T18:00:00.000Z", assignees: [{ id: 1, name: "Иван", initials: "И" }] }),
      ],
      operativeTasks: [],
      personalPlanItems: [],
      completions: [],
      referenceDate: now,
      policy: DEFAULT_SLA_POLICY,
    });

    const users = summarizeUserAttention(attention);
    expect(users[0]).toMatchObject({ user: { name: "Иван" }, overdue: 1, dueToday: 1, total: 2 });
    expect(users[1]).toMatchObject({ user: { name: "Анна" }, blocked: 1, total: 1 });
  });
});
