import { desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { appSettings, notifications, reportExports, slaRules, tasks } from "@/shared/db/schema";
import { getAllEpicsWithTasks } from "@/entities/epic/epicRepository";
import { getAllUsersWithOperativeTasks } from "@/entities/operative/operativeRepository";
import { getPersonalPlanData } from "@/entities/personal-plan/personalPlanRepository";
import {
  classifyTaskRisk,
  DEFAULT_SLA_POLICY,
  formatRiskLabel,
  summarizeTaskRisks,
  type SlaPolicy,
} from "@/shared/lib/management-metrics";
import type { DbNotification, TaskRiskStatus, TaskView } from "@/shared/types";

export type ManagementOverview = Awaited<ReturnType<typeof getManagementOverview>>;

export async function getEffectiveSlaPolicy(): Promise<SlaPolicy> {
  const rows = await db.select().from(slaRules);
  const fallback = rows.find((row) => row.isDefault) ?? rows[0];
  return fallback
    ? { dueSoonHours: fallback.dueSoonHours, staleHours: fallback.staleHours }
    : DEFAULT_SLA_POLICY;
}

export async function getManagementOverview(referenceDate = new Date()) {
  const [epics, operativeBlocks, personalPlan, policy] = await Promise.all([
    getAllEpicsWithTasks(),
    getAllUsersWithOperativeTasks(),
    getPersonalPlanData(referenceDate),
    getEffectiveSlaPolicy(),
  ]);

  const allTasks = epics.flatMap((epic) =>
    epic.tasks.map((task) => ({
      ...task,
      epicTitle: epic.title,
      epicColor: epic.color,
      assigneeCount: task.assignees.length,
    }))
  );

  const riskItems = allTasks.map((task) => ({
    task,
    risk: classifyTaskRisk(task, referenceDate, policy),
  }));
  const riskSummary = summarizeTaskRisks(allTasks, referenceDate, policy);

  const personalTotal = personalPlan.users.reduce((sum, block) => sum + block.items.length, 0);
  const personalCompleted = personalPlan.completions.length;
  const operativeTasks = operativeBlocks.flatMap((block) => block.tasks.map((task) => ({ task, user: block.user })));
  const operativeOpen = operativeTasks.filter(({ task }) => task.status !== "done").length;

  const workload = operativeBlocks.map((block) => {
    const boardTasks = allTasks.filter((task) => task.assignees.some((user) => user.id === block.user.id));
    const openBoardTasks = boardTasks.filter((task) => task.status !== "done");
    const openOperativeTasks = block.tasks.filter((task) => task.status !== "done");
    const overdueBoardTasks = boardTasks.filter((task) =>
      classifyTaskRisk({ ...task, assigneeCount: task.assignees.length }, referenceDate, policy) === "overdue"
    );

    return {
      user: block.user,
      boardOpen: openBoardTasks.length,
      operativeOpen: openOperativeTasks.length,
      overdue: overdueBoardTasks.length,
      totalOpen: openBoardTasks.length + openOperativeTasks.length,
      completedOperative: block.tasks.filter((task) => task.status === "done").length,
    };
  }).sort((a, b) => b.totalOpen - a.totalOpen);

  const attentionQueue = riskItems
    .filter((item) => ["overdue", "blocked", "stale", "unassigned", "due_today"].includes(item.risk))
    .sort((a, b) => riskWeight(b.risk) - riskWeight(a.risk))
    .slice(0, 12)
    .map(({ task, risk }) => ({
      id: task.id,
      title: task.title,
      epicId: task.epicId,
      epicTitle: task.epicTitle,
      epicColor: task.epicColor,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
      risk,
      riskLabel: formatRiskLabel(risk),
      assignees: task.assignees.map((user) => ({ id: user.id, name: user.name, initials: user.initials })),
    }));

  const calendar = buildManagementCalendar(allTasks, operativeTasks, personalPlan);

  return {
    generatedAt: referenceDate.toISOString(),
    policy,
    kpi: {
      totalTasks: riskSummary.total,
      openTasks: riskSummary.open,
      completedTasks: riskSummary.completed,
      completionRate: riskSummary.completionRate,
      attentionRequired: riskSummary.controlAttention,
      operativeOpen,
      personalPlanCompletionRate: personalTotal > 0 ? Math.round((personalCompleted / personalTotal) * 100) : 0,
    },
    riskSummary: riskSummary.counters,
    workload,
    attentionQueue,
    calendar,
  };
}

export async function listNotifications(userId?: string | null): Promise<DbNotification[]> {
  return db
    .select()
    .from(notifications)
    .where(userId ? eq(notifications.recipientUserId, userId) : isNull(notifications.recipientUserId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(50);
}

export async function createNotification(input: {
  recipientUserId?: string | null;
  title: string;
  body: string;
  kind?: string;
  entityType?: string | null;
  entityId?: string | number | null;
}) {
  const [row] = await db
    .insert(notifications)
    .values({
      recipientUserId: input.recipientUserId ?? null,
      title: input.title,
      body: input.body,
      kind: input.kind ?? "info",
      entityType: input.entityType ?? null,
      entityId: input.entityId != null ? String(input.entityId) : null,
    })
    .returning();
  return row;
}

export async function markNotificationsRead(ids: number[]) {
  if (!ids.length) return;
  const patch = { readAt: new Date().toISOString() };
  await db
    .update(notifications)
    .set(patch)
    .where(inArray(notifications.id, ids));
}

export async function getAppSettings() {
  const rows = await db.select().from(appSettings);
  return Object.fromEntries(rows.map((row) => [row.key, safeJson(row.valueJson)]));
}

export async function upsertAppSetting(key: string, value: unknown) {
  const row = {
    key,
    valueJson: JSON.stringify(value),
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(appSettings)
    .values(row)
    .onConflictDoUpdate({ target: appSettings.key, set: row });
}

export async function recordReportExport(input: {
  type: string;
  format: string;
  filters?: unknown;
  createdByUserId?: string | null;
}) {
  const [row] = await db
    .insert(reportExports)
    .values({
      type: input.type,
      format: input.format,
      filtersJson: input.filters !== undefined ? JSON.stringify(input.filters) : null,
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();
  return row;
}

export async function syncStoredRiskStatuses(referenceDate = new Date()) {
  const policy = await getEffectiveSlaPolicy();
  const rows = await db.select().from(tasks);
  for (const task of rows) {
    const riskStatus = classifyTaskRisk({ ...task, assigneeCount: 1 }, referenceDate, policy);
    if (task.riskStatus !== riskStatus) {
      await db.update(tasks).set({ riskStatus }).where(eq(tasks.id, task.id));
    }
  }
}

function buildManagementCalendar(
  tasks: Array<TaskView & { epicTitle: string; epicColor: string }>,
  operativeTasks: Array<{ task: { id: number; title: string; dueDate: string | null; status: string }; user: { name: string } }>,
  personalPlan: Awaited<ReturnType<typeof getPersonalPlanData>>,
) {
  const events: Array<{
    date: string;
    type: "task" | "operative" | "personal_plan";
    title: string;
    subtitle: string;
    href?: string;
    color: string;
    status?: string;
  }> = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;
    events.push({
      date: task.dueDate.slice(0, 10),
      type: "task",
      title: task.title,
      subtitle: task.epicTitle,
      href: `/tasks/${task.id}`,
      color: task.epicColor,
      status: task.status,
    });
  }

  for (const { task, user } of operativeTasks) {
    if (!task.dueDate) continue;
    events.push({
      date: task.dueDate.slice(0, 10),
      type: "operative",
      title: task.title,
      subtitle: user.name,
      color: "#38bdf8",
      status: task.status,
    });
  }

  const completionKeys = new Set(personalPlan.completions.map((item) => `${item.itemId}:${item.date}`));
  for (const block of personalPlan.users) {
    for (const item of block.items) {
      const day = personalPlan.weekDates.find((entry) => entry.weekday === item.weekday);
      if (!day) continue;
      events.push({
        date: day.isoDate,
        type: "personal_plan",
        title: item.title,
        subtitle: block.user.name,
        color: item.color,
        status: completionKeys.has(`${item.id}:${day.isoDate}`) ? "done" : "todo",
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 80);
}

function riskWeight(risk: TaskRiskStatus) {
  const weights: Record<TaskRiskStatus, number> = {
    overdue: 100,
    blocked: 90,
    due_today: 80,
    stale: 70,
    unassigned: 60,
    at_risk: 50,
    on_track: 10,
    completed: 0,
  };
  return weights[risk];
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
