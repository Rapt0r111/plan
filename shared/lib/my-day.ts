import { classifyTaskRisk, type ManagementTaskLike, type SlaPolicy } from "@/shared/lib/management-metrics";
import { getPersonalPlanItemState, type PersonalPlanCompletionLike, type PersonalPlanItemLike } from "@/shared/lib/personal-plan";
import type { TaskPriority, TaskRiskStatus, TaskStatus, UserWithMeta } from "@/shared/types";

export type MyDayRisk = Extract<TaskRiskStatus, "overdue" | "blocked" | "due_today" | "stale" | "unassigned" | "at_risk">;
export type MyDaySource = "board" | "operative" | "personal_plan";
export type MyDaySection = "urgent" | "today" | "later" | "waiting";
export type MyDaySortReason = "overdue" | "due_today" | "high_priority" | "blocked" | "stale" | "due_soon" | "weekly_plan" | "assigned";
export type MyDayActionStatus = TaskStatus | "scheduled";

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
  source: MyDaySource;
  risk: MyDayRisk;
  sortReason: MyDaySortReason;
  section: MyDaySection;
  label: string;
  subtitle: string;
  assigneeNames: string[];
  dueDate?: string | null;
  blockedReason?: string | null;
  priority?: TaskPriority;
  status: MyDayActionStatus;
  updatedAt?: string | null;
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
  includeAssignedFallback?: boolean;
}) {
  const attention: MyDayAttentionItem[] = [];

  for (const task of input.boardTasks) {
    if (task.status === "done") continue;

    const risk = classifyTaskRisk(task, input.referenceDate, input.policy);
    const sortReason = getBoardSortReason(task, risk, input.referenceDate, input.policy);

    if (!sortReason && !input.includeAssignedFallback) continue;

    const effectiveReason = sortReason ?? "assigned";
    const effectiveRisk = getRiskForReason(effectiveReason, risk);

    attention.push({
      id: task.id,
      title: task.title,
      href: `/tasks/${task.id}`,
      source: "board",
      risk: effectiveRisk,
      sortReason: effectiveReason,
      section: sectionForReason(effectiveReason),
      label: labelForReason(effectiveReason),
      subtitle: task.epicTitle,
      assigneeNames: task.assignees.map((user) => user.name),
      dueDate: task.dueDate,
      blockedReason: task.blockedReason,
      priority: task.priority,
      status: task.status,
      updatedAt: task.updatedAt,
    });
  }

  for (const item of input.operativeTasks) {
    if (item.status === "done") continue;

    const sortReason = getOperativeSortReason(item, input.referenceDate, input.policy);
    if (!sortReason && !input.includeAssignedFallback) continue;

    const effectiveReason = sortReason ?? "assigned";

    attention.push({
      id: item.id,
      title: item.title,
      href: "/operative",
      source: "operative",
      risk: getRiskForReason(effectiveReason),
      sortReason: effectiveReason,
      section: sectionForReason(effectiveReason),
      label: labelForReason(effectiveReason),
      subtitle: "Оперативная задача",
      assigneeNames: [item.user.name],
      dueDate: item.dueDate,
      status: item.status,
      updatedAt: item.updatedAt,
    });
  }

  for (const item of input.personalPlanItems) {
    const state = getPersonalPlanItemState(item, input.completions, input.referenceDate);
    if (state.status !== "current" && state.status !== "overdue") continue;

    const sortReason: MyDaySortReason = state.status === "overdue" ? "overdue" : "due_today";

    attention.push({
      id: item.id,
      title: item.title,
      href: "/personal-plan",
      source: "personal_plan",
      risk: state.status === "overdue" ? "overdue" : "due_today",
      sortReason,
      section: sectionForReason(sortReason),
      label: state.status === "overdue" ? "Недельный план просрочен" : "Сейчас по плану",
      subtitle: `${item.startTime}–${item.endTime}`,
      assigneeNames: [item.user.name],
      dueDate: state.occurrenceDate,
      status: "scheduled",
    });
  }

  return attention.sort(compareMyDayItems);
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

export function groupMyDayAttentionBySection(items: MyDayAttentionItem[]): Record<MyDaySection, MyDayAttentionItem[]> {
  return {
    urgent: items.filter((item) => item.section === "urgent"),
    today: items.filter((item) => item.section === "today"),
    later: items.filter((item) => item.section === "later"),
    waiting: items.filter((item) => item.section === "waiting"),
  };
}

function getBoardSortReason(
  task: MyDayBoardTask,
  risk: TaskRiskStatus,
  referenceDate: Date,
  policy: SlaPolicy,
): MyDaySortReason | null {
  if (isBeforeLocalDate(task.dueDate, referenceDate)) return "overdue";
  if (isSameLocalDate(task.dueDate, referenceDate)) return "due_today";
  if (task.priority === "critical" || task.priority === "high") return "high_priority";
  if (task.status === "blocked" || task.blockedReason || risk === "blocked") return "blocked";
  if (risk === "stale") return "stale";
  if (isDueSoon(task.dueDate, referenceDate, policy.dueSoonHours)) return "due_soon";
  return null;
}

function getOperativeSortReason(
  task: MyDayOperativeTask,
  referenceDate: Date,
  policy: SlaPolicy,
): MyDaySortReason | null {
  if (isBeforeLocalDate(task.dueDate, referenceDate)) return "overdue";
  if (isSameLocalDate(task.dueDate, referenceDate)) return "due_today";
  if (isDueSoon(task.dueDate, referenceDate, policy.dueSoonHours)) return "due_soon";
  return null;
}

function compareMyDayItems(a: MyDayAttentionItem, b: MyDayAttentionItem) {
  return reasonWeight(a.sortReason) - reasonWeight(b.sortReason)
    || (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31")
    || priorityWeight(b.priority) - priorityWeight(a.priority)
    || (a.updatedAt ?? "").localeCompare(b.updatedAt ?? "")
    || a.title.localeCompare(b.title);
}

function reasonWeight(reason: MyDaySortReason) {
  const weights: Record<MyDaySortReason, number> = {
    overdue: 0,
    due_today: 1,
    high_priority: 2,
    blocked: 3,
    stale: 4,
    due_soon: 5,
    weekly_plan: 6,
    assigned: 7,
  };
  return weights[reason];
}

function priorityWeight(priority: TaskPriority | undefined) {
  const weights: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return priority ? weights[priority] : 0;
}

function getRiskForReason(reason: MyDaySortReason, fallback?: TaskRiskStatus): MyDayRisk {
  if (reason === "overdue") return "overdue";
  if (reason === "due_today" || reason === "weekly_plan") return "due_today";
  if (reason === "blocked") return "blocked";
  if (reason === "stale") return "stale";
  if (reason === "high_priority" || reason === "due_soon") return "at_risk";
  if (fallback && ["overdue", "blocked", "due_today", "stale", "unassigned", "at_risk"].includes(fallback)) {
    return fallback as MyDayRisk;
  }
  return "at_risk";
}

function sectionForReason(reason: MyDaySortReason): MyDaySection {
  if (reason === "blocked") return "waiting";
  if (reason === "overdue" || reason === "high_priority") return "urgent";
  if (reason === "due_today" || reason === "weekly_plan") return "today";
  return "later";
}

function labelForReason(reason: MyDaySortReason) {
  const labels: Record<MyDaySortReason, string> = {
    overdue: "Просрочено",
    due_today: "Срок сегодня",
    high_priority: "Высокий приоритет",
    blocked: "Заблокировано",
    stale: "Нет движения",
    due_soon: "Скоро срок",
    weekly_plan: "Недельный план",
    assigned: "Назначено",
  };
  return labels[reason];
}

function isDueSoon(value: string | null | undefined, referenceDate: Date, dueSoonHours: number) {
  if (!value || isBeforeLocalDate(value, referenceDate) || isSameLocalDate(value, referenceDate)) return false;
  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) return false;
  const hoursToDue = (dueAt.getTime() - referenceDate.getTime()) / 36e5;
  return hoursToDue >= 0 && hoursToDue <= dueSoonHours;
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "??";
}
