// features/timeline/model/useTimelineLayout.ts
import { useMemo } from "react";
import type { EpicWithTasks } from "@/shared/types";

export const PX_PER_DAY = 6;
export const LANE_H = 56;
export const RULER_H = 44;
export const LEFT_W = 196;
export const RIGHT_PAD = 80;
export const MIN_BAR_W = 72;
export const MAX_AREA_H = 520;

export interface Bar {
  epic: EpicWithTasks;
  barX: number;
  barW: number;
  pct: number;
  hasDates: boolean;
  overdue: boolean;
}

export interface TimelineLayout {
  origin: Date;
  canvasW: number;
  todayX: number;
  bars: Bar[];
  months: { x: number; label: string; isJan: boolean }[];
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function buildLayout(epics: EpicWithTasks[]): TimelineLayout {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let origin = addDays(now, -20);
  let terminus = addDays(now, 90);

  const dated = epics.filter((e) => e.startDate || e.endDate);
  if (dated.length) {
    const ss = dated.filter((e) => e.startDate).map((e) => new Date(e.startDate!).getTime());
    const es = dated.filter((e) => e.endDate).map((e) => new Date(e.endDate!).getTime());
    if (ss.length) origin = addDays(new Date(Math.min(...ss)), -16);
    if (es.length) terminus = addDays(new Date(Math.max(...es)), 18);
  }

  const canvasW = daysBetween(origin, terminus) * PX_PER_DAY + RIGHT_PAD;
  const todayX = daysBetween(origin, now) * PX_PER_DAY;

  const bars: Bar[] = epics.map((epic) => {
    const pct = epic.progress.total > 0 ? epic.progress.done / epic.progress.total : 0;
    if (!epic.startDate && !epic.endDate) {
      return { epic, barX: 12, barW: canvasW - 40, pct, hasDates: false, overdue: false };
    }
    const start = new Date(epic.startDate ?? now);
    start.setHours(0, 0, 0, 0);
    const end = epic.endDate ? new Date(epic.endDate) : addDays(start, 30);
    end.setHours(0, 0, 0, 0);
    const barX = Math.max(0, daysBetween(origin, start) * PX_PER_DAY);
    const barW = Math.max(daysBetween(start, end) * PX_PER_DAY, MIN_BAR_W);
    return { epic, barX, barW, pct, hasDates: true, overdue: end < now && pct < 1 };
  });

  const months: TimelineLayout["months"] = [];
  const cur = new Date(origin);
  cur.setDate(1);
  while (cur <= terminus) {
    months.push({
      x: Math.max(0, daysBetween(origin, cur) * PX_PER_DAY),
      label: cur.toLocaleDateString("ru-RU", {
        month: "long",
        ...(cur.getMonth() === 0 ? { year: "2-digit" } : {}),
      }),
      isJan: cur.getMonth() === 0,
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  return { origin, canvasW, todayX, bars, months };
}

export function useTimelineLayout(epics: EpicWithTasks[]): TimelineLayout {
  return useMemo(() => buildLayout(epics), [epics]);
}