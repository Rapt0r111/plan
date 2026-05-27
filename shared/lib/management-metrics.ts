import type { TaskPriority, TaskRiskStatus, TaskStatus } from "@/shared/db/schema";

export type ManagementTaskLike = {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  updatedAt: string;
  createdAt: string;
  completedAt?: string | null;
  blockedReason?: string | null;
  assigneeCount?: number;
};

export type SlaPolicy = {
  dueSoonHours: number;
  staleHours: number;
};

export const DEFAULT_SLA_POLICY: SlaPolicy = {
  dueSoonHours: 24,
  staleHours: 72,
};

export function classifyTaskRisk(
  task: ManagementTaskLike,
  now: Date = new Date(),
  policy: SlaPolicy = DEFAULT_SLA_POLICY,
): TaskRiskStatus {
  if (task.status === "done" || task.completedAt) return "completed";
  if (task.status === "blocked" || task.blockedReason) return "blocked";
  if ((task.assigneeCount ?? 1) === 0) return "unassigned";

  const dueAt = parseOptionalDate(task.dueDate);
  if (dueAt) {
    const hoursToDue = (dueAt.getTime() - now.getTime()) / 36e5;
    if (hoursToDue < 0) return "overdue";
    if (hoursToDue <= policy.dueSoonHours) return "due_today";
  }

  const updatedAt = parseOptionalDate(task.updatedAt) ?? parseOptionalDate(task.createdAt);
  if (updatedAt) {
    const staleHours = (now.getTime() - updatedAt.getTime()) / 36e5;
    if (staleHours >= policy.staleHours) return "stale";
  }

  if (task.priority === "critical" || task.priority === "high") return "at_risk";
  return "on_track";
}

export function summarizeTaskRisks(
  tasks: ManagementTaskLike[],
  now: Date = new Date(),
  policy: SlaPolicy = DEFAULT_SLA_POLICY,
) {
  const counters: Record<TaskRiskStatus, number> = {
    on_track: 0,
    at_risk: 0,
    due_today: 0,
    overdue: 0,
    blocked: 0,
    stale: 0,
    unassigned: 0,
    completed: 0,
  };

  for (const task of tasks) {
    counters[classifyTaskRisk(task, now, policy)] += 1;
  }

  const open = tasks.filter((task) => task.status !== "done").length;
  const completed = counters.completed;
  const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  const controlAttention = counters.overdue + counters.blocked + counters.stale + counters.unassigned;

  return {
    counters,
    total: tasks.length,
    open,
    completed,
    completionRate,
    controlAttention,
  };
}

export function formatRiskLabel(risk: TaskRiskStatus): string {
  const labels: Record<TaskRiskStatus, string> = {
    on_track: "В норме",
    at_risk: "Риск",
    due_today: "Срок сегодня",
    overdue: "Просрочено",
    blocked: "Заблокировано",
    stale: "Нет движения",
    unassigned: "Без ответственного",
    completed: "Выполнено",
  };
  return labels[risk];
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
