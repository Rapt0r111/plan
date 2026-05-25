import { describe, expect, it } from "vitest";
import {
  getCurrentWeekDates,
  getPersonalPlanDenseDayMaxHeight,
  getPersonalPlanItemState,
  getPlanOccurrenceDate,
  PERSONAL_PLAN_DENSE_DAY_ITEM_CAPACITY,
  PERSONAL_PLAN_DENSE_ITEM_GAP_PX,
  PERSONAL_PLAN_DENSE_ITEM_HEIGHT_PX,
  PERSONAL_PLAN_WEEK_COLUMN_TEMPLATE,
  sortPersonalPlanItems,
  type PersonalPlanCompletionLike,
  type PersonalPlanItemLike,
} from "@/shared/lib/personal-plan";

function item(partial: Partial<PersonalPlanItemLike> & Pick<PersonalPlanItemLike, "id" | "weekday">): PersonalPlanItemLike {
  return {
    id: partial.id,
    weekday: partial.weekday,
    title: `Task ${partial.id}`,
    startTime: partial.startTime ?? "09:00",
    endTime: partial.endTime ?? "10:00",
    sortOrder: partial.sortOrder ?? partial.id,
  };
}

function completion(itemId: number, date: string): PersonalPlanCompletionLike {
  return { itemId, date };
}

describe("personal plan helpers", () => {
  it("builds a Monday-Sunday current week for a Russian workweek layout", () => {
    const week = getCurrentWeekDates(new Date("2026-05-22T12:00:00.000Z"));

    expect(week.map((day) => day.isoDate)).toEqual([
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
      "2026-05-21",
      "2026-05-22",
      "2026-05-23",
      "2026-05-24",
    ]);
    expect(week.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(week.map((day) => day.shortLabel)).toEqual(["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]);
  });

  it("keeps the personal plan grid dense enough for seven days and ten rows", () => {
    expect(PERSONAL_PLAN_WEEK_COLUMN_TEMPLATE).toBe("repeat(7, minmax(0, 1fr))");
    expect(PERSONAL_PLAN_DENSE_DAY_ITEM_CAPACITY).toBe(10);
    expect(getPersonalPlanDenseDayMaxHeight()).toBe(
      PERSONAL_PLAN_DENSE_DAY_ITEM_CAPACITY * PERSONAL_PLAN_DENSE_ITEM_HEIGHT_PX +
      (PERSONAL_PLAN_DENSE_DAY_ITEM_CAPACITY - 1) * PERSONAL_PLAN_DENSE_ITEM_GAP_PX
    );
  });

  it("maps a recurring weekday item to the matching date of the current week", () => {
    expect(getPlanOccurrenceDate(1, new Date("2026-05-22T12:00:00.000Z"))).toBe("2026-05-18");
    expect(getPlanOccurrenceDate(7, new Date("2026-05-22T12:00:00.000Z"))).toBe("2026-05-24");
  });

  it("marks only unfinished past occurrences as overdue", () => {
    const fridayMorning = new Date(2026, 4, 22, 8, 30);
    const fridayNoon = new Date(2026, 4, 22, 12, 0);
    const mondayTask = item({ id: 1, weekday: 1, endTime: "18:00" });
    const fridayTask = item({ id: 2, weekday: 5, startTime: "09:00", endTime: "11:00" });

    expect(getPersonalPlanItemState(mondayTask, [], fridayMorning).status).toBe("overdue");
    expect(getPersonalPlanItemState(fridayTask, [], fridayMorning).status).toBe("upcoming");
    expect(getPersonalPlanItemState(fridayTask, [], fridayNoon).status).toBe("overdue");
    expect(getPersonalPlanItemState(fridayTask, [completion(2, "2026-05-22")], fridayNoon).status).toBe("completed");
  });

  it("detects the task currently in progress during its time window", () => {
    const planItem = item({ id: 3, weekday: 5, startTime: "09:00", endTime: "11:00" });

    expect(getPersonalPlanItemState(planItem, [], new Date(2026, 4, 22, 10, 0)).status).toBe("current");
  });

  it("sorts tasks by weekday, start time, end time, and saved order", () => {
    const sorted = sortPersonalPlanItems([
      item({ id: 4, weekday: 2, startTime: "09:00", endTime: "10:00" }),
      item({ id: 1, weekday: 1, startTime: "11:00", endTime: "12:00" }),
      item({ id: 3, weekday: 1, startTime: "09:00", endTime: "11:00", sortOrder: 2 }),
      item({ id: 2, weekday: 1, startTime: "09:00", endTime: "10:00", sortOrder: 1 }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual([2, 3, 1, 4]);
  });
});
