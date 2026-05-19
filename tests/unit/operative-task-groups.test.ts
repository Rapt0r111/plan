import { describe, expect, it } from "vitest";
import {
  OPERATIVE_TASK_GROUPS,
  getNextTopOrder,
  groupOperativeTasksByStatus,
  sortOperativeTasksForStatus,
} from "@/shared/lib/operative-task-groups";

type TestTask = {
  id: number;
  status: "todo" | "in_progress" | "done";
  order: number;
  createdAt: string;
  updatedAt: string;
};

function task(partial: Partial<TestTask> & Pick<TestTask, "id" | "status">): TestTask {
  return {
    order: partial.id,
    createdAt: `2026-05-${String(partial.id).padStart(2, "0")}T10:00:00.000Z`,
    updatedAt: `2026-05-${String(partial.id).padStart(2, "0")}T10:00:00.000Z`,
    ...partial,
  };
}

describe("operative task groups", () => {
  it("keeps the category order stable for the operative board", () => {
    expect(OPERATIVE_TASK_GROUPS.map((group) => group.status)).toEqual([
      "todo",
      "in_progress",
      "done",
    ]);
  });

  it("groups tasks by status and uses saved order inside each category", () => {
    const grouped = groupOperativeTasksByStatus([
      task({ id: 1, status: "todo", order: 2, createdAt: "2026-05-18T10:00:00.000Z" }),
      task({ id: 2, status: "done", createdAt: "2026-05-17T10:00:00.000Z" }),
      task({ id: 3, status: "todo", order: 1, createdAt: "2026-05-19T10:00:00.000Z" }),
      task({ id: 4, status: "in_progress", createdAt: "2026-05-16T10:00:00.000Z" }),
    ]);

    expect(grouped.todo.map((item) => item.id)).toEqual([3, 1]);
    expect(grouped.in_progress.map((item) => item.id)).toEqual([4]);
    expect(grouped.done.map((item) => item.id)).toEqual([2]);
  });

  it("does not let a newer task override a saved drag order", () => {
    const sorted = sortOperativeTasksForStatus([
      task({ id: 1, status: "todo", order: 1, createdAt: "2026-05-18T10:00:00.000Z" }),
      task({ id: 2, status: "todo", order: 2, createdAt: "2026-05-19T10:00:00.000Z" }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([1, 2]);
  });

  it("allocates a new top order above the current stack", () => {
    expect(getNextTopOrder([{ order: 4 }, { order: 2 }, { order: 8 }])).toBe(1);
    expect(getNextTopOrder([])).toBe(0);
  });
});
