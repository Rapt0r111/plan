import type { WorkspaceAccessScope } from "@/shared/lib/access-scope";

export function getSessionProfileId(scope: WorkspaceAccessScope): number | null {
  return scope.profile?.id
    ?? ((scope.session.user as { profileId?: number | null }).profileId ?? null);
}

export function canManageOperativeUser(scope: WorkspaceAccessScope, userId: number): boolean {
  if (scope.isAdmin) return true;
  return getSessionProfileId(scope) === userId;
}

export function canManageOperativeTask(scope: WorkspaceAccessScope, task: { userId: number }): boolean {
  return canManageOperativeUser(scope, task.userId);
}

export function resolveOperativeCreateUserId(
  scope: WorkspaceAccessScope,
  requestedUserId: number | undefined,
): { userId: number; mode: "admin_for_user" | "self" } {
  if (scope.isAdmin) {
    if (requestedUserId == null) {
      throw new Error("TARGET_USER_REQUIRED");
    }
    return { userId: requestedUserId, mode: "admin_for_user" };
  }

  const profileId = getSessionProfileId(scope);
  if (profileId == null) {
    throw new Error("PROFILE_REQUIRED");
  }

  if (requestedUserId != null && requestedUserId !== profileId) {
    throw new Error("OPERATIVE_TASK_SELF_ONLY");
  }

  return { userId: profileId, mode: "self" };
}
