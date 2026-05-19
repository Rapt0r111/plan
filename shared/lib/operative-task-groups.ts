import type { OperativeTaskStatus } from "@/entities/operative/operativeRepository";

export const OPERATIVE_TASK_GROUPS = [
  {
    status: "todo",
    label: "Новые задачи",
    tone: "red",
    color: "#f87171",
    background: "rgba(248,113,113,0.12)",
    border: "rgba(248,113,113,0.32)",
  },
  {
    status: "in_progress",
    label: "В работе",
    tone: "blue",
    color: "#38bdf8",
    background: "rgba(56,189,248,0.12)",
    border: "rgba(56,189,248,0.32)",
  },
  {
    status: "done",
    label: "Выполнено",
    tone: "green",
    color: "#34d399",
    background: "rgba(52,211,153,0.12)",
    border: "rgba(52,211,153,0.32)",
  },
] as const satisfies readonly {
  status: OperativeTaskStatus;
  label: string;
  tone: string;
  color: string;
  background: string;
  border: string;
}[];

export type OperativeTaskGroupMeta = (typeof OPERATIVE_TASK_GROUPS)[number];

export type GroupableOperativeTask = {
  status: OperativeTaskStatus;
  order: number;
  createdAt: string;
};

export type OperativeTasksByStatus<T extends GroupableOperativeTask> = Record<
  OperativeTaskStatus,
  T[]
>;

export function sortOperativeTasksForStatus<T extends GroupableOperativeTask>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const orderDiff = a.order - b.order;
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function getNextTopOrder(tasks: { order: number }[]): number {
  if (tasks.length === 0) return 0;
  return Math.min(...tasks.map((task) => task.order)) - 1;
}

export function groupOperativeTasksByStatus<T extends GroupableOperativeTask>(
  tasks: T[],
): OperativeTasksByStatus<T> {
  const grouped = {
    todo: [],
    in_progress: [],
    done: [],
  } as OperativeTasksByStatus<T>;

  for (const task of tasks) grouped[task.status].push(task);

  for (const group of OPERATIVE_TASK_GROUPS) {
    grouped[group.status] = sortOperativeTasksForStatus(grouped[group.status]);
  }

  return grouped;
}
