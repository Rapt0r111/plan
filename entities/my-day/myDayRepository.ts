import { getAllEpicsWithTasks } from "@/entities/epic/epicRepository";
import { getEffectiveSlaPolicy } from "@/entities/management/managementRepository";
import { getAllUsersWithOperativeTasks } from "@/entities/operative/operativeRepository";
import { getPersonalPlanData } from "@/entities/personal-plan/personalPlanRepository";
import { filterEpicsByAccess, type WorkspaceAccessScope } from "@/shared/lib/access-scope";
import { getUserPersonnelGroupKey } from "@/shared/lib/personnel-composition";
import {
  buildMyDayAttention,
  buildMyDayStats,
  getLocalDateKey,
  summarizeUserAttention,
  type MyDayBoardTask,
  type MyDayOperativeTask,
  type MyDayPersonalPlanItem,
} from "@/shared/lib/my-day";

export type MyDayOverview = Awaited<ReturnType<typeof getMyDayOverview>>;

export async function getMyDayOverview(referenceDate = new Date(), scope: WorkspaceAccessScope) {
  const [rawEpics, rawOperativeBlocks, rawPersonalPlan, policy] = await Promise.all([
    getAllEpicsWithTasks(),
    getAllUsersWithOperativeTasks(),
    getPersonalPlanData(referenceDate),
    getEffectiveSlaPolicy(),
  ]);

  const epics = filterEpicsByAccess(rawEpics, scope);
  const operativeBlocks = scope.isVariableRestricted
    ? rawOperativeBlocks.filter((block) => getUserPersonnelGroupKey(block.user) === "variable")
    : rawOperativeBlocks;
  const personalPlan = scope.isVariableRestricted
    ? { ...rawPersonalPlan, users: [], completions: [] }
    : rawPersonalPlan;

  const profileId = scope.profile?.id ?? null;
  const boardTasks: MyDayBoardTask[] = epics.flatMap((epic) =>
    epic.tasks
      .filter((task) => task.status !== "done")
      .map((task) => ({
        ...task,
        epicTitle: epic.title,
        epicColor: epic.color,
        assigneeCount: task.assignees.length,
        assignees: task.assignees.map((user) => ({
          id: user.id,
          name: user.name,
          initials: user.initials,
        })),
      }))
  );

  const operativeTasks: MyDayOperativeTask[] = operativeBlocks.flatMap((block) =>
    block.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
      updatedAt: task.updatedAt,
      createdAt: task.createdAt,
      user: {
        id: block.user.id,
        name: block.user.name,
        initials: block.user.initials,
      },
    }))
  );

  const personalPlanItems: MyDayPersonalPlanItem[] = personalPlan.users.flatMap((block) =>
    block.items.map((item) => ({
      ...item,
      user: {
        id: block.user.id,
        name: block.user.name,
        initials: block.user.initials,
      },
    }))
  );

  const allAttention = buildMyDayAttention({
    boardTasks,
    operativeTasks,
    personalPlanItems,
    completions: personalPlan.completions,
    referenceDate,
    policy,
  });

  const myBoardTasks = profileId
    ? boardTasks.filter((task) => task.assignees.some((user) => user.id === profileId))
    : [];
  const myOperativeTasks = profileId
    ? operativeTasks.filter((task) => task.user.id === profileId && task.status !== "done")
    : [];
  const myPersonalPlanItems = profileId
    ? personalPlanItems.filter((item) => item.user.id === profileId)
    : [];

  const myAttention = buildMyDayAttention({
    boardTasks: myBoardTasks,
    operativeTasks: myOperativeTasks,
    personalPlanItems: myPersonalPlanItems,
    completions: personalPlan.completions,
    referenceDate,
    policy,
  });

  const todayKey = getLocalDateKey(referenceDate);
  const todayPersonalPlan = myPersonalPlanItems
    .filter((item) => personalPlan.weekDates.find((day) => day.weekday === item.weekday)?.isoDate === todayKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder);

  return {
    generatedAt: referenceDate.toISOString(),
    todayKey,
    policy,
    my: {
      attention: myAttention,
      stats: buildMyDayStats(myAttention),
      boardTasks: myBoardTasks,
      operativeTasks: myOperativeTasks,
      personalPlan: todayPersonalPlan,
    },
    team: {
      attention: allAttention,
      stats: buildMyDayStats(allAttention),
      users: summarizeUserAttention(allAttention),
    },
  };
}
