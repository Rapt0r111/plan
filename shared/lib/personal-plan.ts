export const PERSONAL_PLAN_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type PersonalPlanWeekday = (typeof PERSONAL_PLAN_WEEKDAYS)[number];
export type PersonalPlanItemStatus = "completed" | "overdue" | "current" | "upcoming";

export interface PersonalPlanItemLike {
  id: number;
  weekday: number;
  title: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
}

export interface PersonalPlanCompletionLike {
  itemId: number;
  date: string;
}

export interface PersonalPlanWeekDate {
  weekday: PersonalPlanWeekday;
  isoDate: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
}

export interface PersonalPlanItemState {
  status: PersonalPlanItemStatus;
  occurrenceDate: string;
  isCompleted: boolean;
  isOverdue: boolean;
  isCurrent: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const PERSONAL_PLAN_DENSE_DAY_ITEM_CAPACITY = 10;
export const PERSONAL_PLAN_DENSE_ITEM_HEIGHT_PX = 50;
export const PERSONAL_PLAN_DENSE_ITEM_GAP_PX = 4;
export const PERSONAL_PLAN_WEEK_COLUMN_TEMPLATE = "repeat(7, minmax(0, 1fr))";

export function getPersonalPlanDenseDayMaxHeight(itemCapacity = PERSONAL_PLAN_DENSE_DAY_ITEM_CAPACITY): number {
  const safeCapacity = Math.max(1, Math.floor(itemCapacity));
  return safeCapacity * PERSONAL_PLAN_DENSE_ITEM_HEIGHT_PX + (safeCapacity - 1) * PERSONAL_PLAN_DENSE_ITEM_GAP_PX;
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getMonday(referenceDate: Date): Date {
  const day = referenceDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = startOfLocalDay(referenceDate);
  monday.setDate(monday.getDate() + mondayOffset);
  return monday;
}

function parseTimeOnDate(isoDate: string, time: string): Date {
  const [hours = "0", minutes = "0"] = time.split(":");
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, Number(hours), Number(minutes), 0, 0);
}

export function isPersonalPlanWeekday(value: number): value is PersonalPlanWeekday {
  return PERSONAL_PLAN_WEEKDAYS.includes(value as PersonalPlanWeekday);
}

export function getCurrentWeekDates(referenceDate = new Date()): PersonalPlanWeekDate[] {
  const monday = getMonday(referenceDate);
  const today = toLocalIsoDate(referenceDate);
  const labels = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
  const shortLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return PERSONAL_PLAN_WEEKDAYS.map((weekday, index) => {
    const date = new Date(monday.getTime() + index * DAY_MS);
    const isoDate = toLocalIsoDate(date);
    return {
      weekday,
      isoDate,
      label: labels[index],
      shortLabel: shortLabels[index],
      isToday: isoDate === today,
    };
  });
}

export function getPlanOccurrenceDate(weekday: number, referenceDate = new Date()): string {
  if (!isPersonalPlanWeekday(weekday)) {
    throw new Error(`Invalid personal plan weekday: ${weekday}`);
  }

  return getCurrentWeekDates(referenceDate)[weekday - 1].isoDate;
}

export function getPersonalPlanItemState(
  item: PersonalPlanItemLike,
  completions: readonly PersonalPlanCompletionLike[],
  referenceDate = new Date(),
): PersonalPlanItemState {
  const occurrenceDate = getPlanOccurrenceDate(item.weekday, referenceDate);
  const isCompleted = completions.some((completion) =>
    completion.itemId === item.id && completion.date === occurrenceDate
  );

  if (isCompleted) {
    return { status: "completed", occurrenceDate, isCompleted: true, isOverdue: false, isCurrent: false };
  }

  const start = parseTimeOnDate(occurrenceDate, item.startTime);
  const end = parseTimeOnDate(occurrenceDate, item.endTime);
  const isOverdue = referenceDate.getTime() > end.getTime();
  const isCurrent = referenceDate.getTime() >= start.getTime() && referenceDate.getTime() <= end.getTime();

  if (isOverdue) {
    return { status: "overdue", occurrenceDate, isCompleted: false, isOverdue: true, isCurrent: false };
  }

  if (isCurrent) {
    return { status: "current", occurrenceDate, isCompleted: false, isOverdue: false, isCurrent: true };
  }

  return { status: "upcoming", occurrenceDate, isCompleted: false, isOverdue: false, isCurrent: false };
}

export function sortPersonalPlanItems<T extends PersonalPlanItemLike>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    a.weekday - b.weekday ||
    a.startTime.localeCompare(b.startTime) ||
    a.endTime.localeCompare(b.endTime) ||
    a.sortOrder - b.sortOrder ||
    a.id - b.id
  );
}

