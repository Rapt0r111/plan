import { classifyTaskRisk, formatRiskLabel, type ManagementTaskLike, type SlaPolicy } from "@/shared/lib/management-metrics";
import { getPersonalPlanItemState, type PersonalPlanCompletionLike, type PersonalPlanItemLike } from "@/shared/lib/personal-plan";
import type { TaskPriority, TaskRiskStatus, TaskStatus, UserWithMeta } from "@/shared/types";

export type MyDayRisk = Extract<TaskRiskStatus, "overdue" | "blocked" | "due_today" | "stale" | "unassigned" | "at_risk">;

export type MyDayBoardTask = ManagementTaskLike & {
  epicId: number;
  epicTitle: string;
  epicColor: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  assignees: Array<Pick<UserWithMeta, "id" | "name" | "initials">>;
};

export type MyDayOperativeTask = {
  id: number;
  title: string;
  description?: string | null;
  status: "todo" | "in_progress" | "done";
  dueDate: string | null;
  updatedAt: string;
  createdAt: string;
  user: Pick<UserWithMeta, "id" | "name" | "initials">;
};

export type MyDayPersonalPlanItem = PersonalPlanItemLike & {
  description?: string | null;
  color?: string;
  user: Pick<UserWithMeta, "id" | "name" | "initials">;
};

export type MyDayAttentionItem = {
  id: number;
  title: string;
  href: string;
  source: "board" | "operative" | "personal_plan";
  risk: MyDayRisk;
  label: string;
  subtitle: string;
  assigneeNames: string[];
  dueDate?: string | null;
  blockedReason?: string | null;
};

export type MyDayUserAttention = {
  user: Pick<UserWithMeta, "id" | "name" | "initials">;
  overdue: number;
  blocked: number;
  stale: number;
  dueToday: number;
  total: number;
};

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSameLocalDate(value: string | null | undefined, date: Date): boolean {
  return !!value && value.slice(0, 10) === getLocalDateKey(date);
}

export function isBeforeLocalDate(value: string | null | undefined, date: Date): boolean {
  return !!value && value.slice(0, 10) < getLocalDateKey(date);
}

export function buildMyDayAttention(input: {
  boardTasks: MyDayBoardTask[];
  operativeTasks: MyDayOperativeTask[];
  personalPlanItems: MyDayPersonalPlanItem[];
  completions: PersonalPlanCompletionLike[];
  referenceDate: Date;
  policy: SlaPolicy;
}) {
  const attention: MyDayAttentionItem[] = [];

  for (const task of input.boardTasks) {
    const risk = classifyTaskRisk(task, input.referenceDate, input.policy);
    const isRelevantRisk = ["overdue", "blocked", "due_today", "stale", "unassigned", "at_risk"].includes(risk);
    const isToday = isSameLocalDate(task.dueDate, input.referenceDate);

    if (!isRelevantRisk && !isToday) continue;

    attention.push({
      id: task.id,
      title: task.title,
      href: `/tasks/${task.id}`,
      source: "board",
      risk: (isRelevantRisk ? risk : "due_today") as MyDayRisk,
      label: isRelevantRisk ? formatRiskLabel(risk) : "Сегодня",
      subtitle: task.epicTitle,
      assigneeNames: task.assignees.map((user) => user.name),
      dueDate: task.dueDate,
      blockedReason: task.blockedReason,
    });
  }

  for (const item of input.operativeTasks) {
    if (item.status === "done") continue;
    const overdue = isBeforeLocalDate(item.dueDate, input.referenceDate);
    const today = isSameLocalDate(item.dueDate, input.referenceDate);
    if (!overdue && !today) continue;

    attention.push({
      id: item.id,
      title: item.title,
      href: "/operative",
      source: "operative",
      risk: overdue ? "overdue" : "due_today",
      label: overdue ? "Просрочено" : "Сегодня",
      subtitle: "Оперативная задача",
      assigneeNames: [item.user.name],
      dueDate: item.dueDate,
    });
  }

  for (const item of input.personalPlanItems) {
    const state = getPersonalPlanItemState(item, input.completions, input.referenceDate);
    if (state.status !== "current" && state.status !== "overdue") continue;

    attention.push({
      id: item.id,
      title: item.title,
      href: "/personal-plan",
      source: "personal_plan",
      risk: state.status === "overdue" ? "overdue" : "due_today",
      label: state.status === "overdue" ? "Недельный план просрочен" : "Сейчас по плану",
      subtitle: `${item.startTime}–${item.endTime}`,
      assigneeNames: [item.user.name],
      dueDate: state.occurrenceDate,
    });
  }

  return attention.sort((a, b) => riskWeight(b.risk) - riskWeight(a.risk) || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

export function summarizeUserAttention(items: MyDayAttentionItem[]): MyDayUserAttention[] {
  const users = new Map<string, MyDayUserAttention>();

  for (const item of items) {
    const assignees = item.assigneeNames.length ? item.assigneeNames : ["Без ответственного"];
    for (const name of assignees) {
      const key = name;
      const current = users.get(key) ?? {
        user: { id: -users.size - 1, name, initials: initialsFromName(name) },
        overdue: 0,
        blocked: 0,
        stale: 0,
        dueToday: 0,
        total: 0,
      };
      current.total += 1;
      if (item.risk === "overdue") current.overdue += 1;
      if (item.risk === "blocked") current.blocked += 1;
      if (item.risk === "stale") current.stale += 1;
      if (item.risk === "due_today") current.dueToday += 1;
      users.set(key, current);
    }
  }

  return [...users.values()].sort((a, b) => b.total - a.total || b.overdue - a.overdue || a.user.name.localeCompare(b.user.name));
}

export function buildMyDayStats(items: MyDayAttentionItem[]) {
  return {
    total: items.length,
    overdue: items.filter((item) => item.risk === "overdue").length,
    blocked: items.filter((item) => item.risk === "blocked").length,
    stale: items.filter((item) => item.risk === "stale").length,
    dueToday: items.filter((item) => item.risk === "due_today").length,
  };
}

function riskWeight(risk: MyDayRisk) {
  const weights: Record<MyDayRisk, number> = {
    overdue: 100,
    blocked: 90,
    due_today: 80,
    stale: 70,
    unassigned: 60,
    at_risk: 50,
  };
  return weights[risk];
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "??";
}
