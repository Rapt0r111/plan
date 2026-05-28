import { getUserPersonnelGroupKey } from "@/shared/lib/personnel-composition";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import type { Session } from "@/shared/lib/auth";
import type { DbPersonnelGroup, DbRole, EpicSummary, EpicWithTasks, TaskView, UserWithMeta } from "@/shared/types";

export type WorkspaceAccessScope = {
  session: Session;
  profile: UserWithMeta | null;
  isAdmin: boolean;
  groupKey: string | null;
  isVariableRestricted: boolean;
};

export async function resolveAccessScope(session: Session): Promise<WorkspaceAccessScope> {
  const isAdmin = session.user.role === "admin";
  const profileId = (session.user as { profileId?: number | null }).profileId;
  const profile = typeof profileId === "number" ? await getUserWithMetaById(profileId) : null;

  if (!isAdmin && !profile) {
    throw new Error("PROFILE_REQUIRED");
  }

  const groupKey = profile ? getUserPersonnelGroupKey(profile) : null;
  return {
    session,
    profile,
    isAdmin,
    groupKey,
    isVariableRestricted: !isAdmin && groupKey === "variable",
  };
}

export function isRestrictedToVariable(scope: WorkspaceAccessScope) {
  return scope.isVariableRestricted;
}

export function canAccessUser(scope: WorkspaceAccessScope, user: UserWithMeta) {
  return !isRestrictedToVariable(scope) || getUserPersonnelGroupKey(user) === "variable";
}

export function canAccessRole(scope: WorkspaceAccessScope, role: DbRole) {
  if (!isRestrictedToVariable(scope)) return true;
  return (role.personnelGroup?.key ?? role.composition) === "variable";
}

export function canAccessPersonnelGroup(scope: WorkspaceAccessScope, group: DbPersonnelGroup) {
  return !isRestrictedToVariable(scope) || group.key === "variable";
}

export function canAccessTask(scope: WorkspaceAccessScope, task: TaskView) {
  if (!isRestrictedToVariable(scope)) return true;
  return task.assignees.length > 0 && task.assignees.every((user) => canAccessUser(scope, user));
}

export function filterUsersByAccess<T extends UserWithMeta>(users: readonly T[], scope: WorkspaceAccessScope): T[] {
  return isRestrictedToVariable(scope) ? users.filter((user) => canAccessUser(scope, user)) : [...users];
}

export function filterRolesByAccess<T extends DbRole>(roles: readonly T[], scope: WorkspaceAccessScope): T[] {
  return isRestrictedToVariable(scope) ? roles.filter((role) => canAccessRole(scope, role)) : [...roles];
}

export function filterPersonnelGroupsByAccess<T extends DbPersonnelGroup>(groups: readonly T[], scope: WorkspaceAccessScope): T[] {
  return isRestrictedToVariable(scope) ? groups.filter((group) => canAccessPersonnelGroup(scope, group)) : [...groups];
}

export function filterTasksByAccess<T extends TaskView>(tasks: readonly T[], scope: WorkspaceAccessScope): T[] {
  return isRestrictedToVariable(scope) ? tasks.filter((task) => canAccessTask(scope, task)) : [...tasks];
}

export function filterEpicsByAccess<T extends EpicWithTasks>(epics: readonly T[], scope: WorkspaceAccessScope): T[] {
  if (!isRestrictedToVariable(scope)) return [...epics];
  return epics
    .map((epic) => {
      const visibleTasks = filterTasksByAccess(epic.tasks, scope);
      return {
        ...epic,
        tasks: visibleTasks,
        progress: {
          done: visibleTasks.filter((task) => task.status === "done").length,
          total: visibleTasks.length,
        },
      };
    })
    .filter((epic) => epic.tasks.length > 0) as T[];
}

export function summarizeEpics(epics: readonly EpicWithTasks[]): EpicSummary[] {
  return epics.map((epic) => ({
    id: epic.id,
    title: epic.title,
    description: epic.description,
    color: epic.color,
    startDate: epic.startDate,
    endDate: epic.endDate,
    createdAt: epic.createdAt,
    updatedAt: epic.updatedAt,
    taskCount: epic.progress.total,
    doneCount: epic.progress.done,
  }));
}

