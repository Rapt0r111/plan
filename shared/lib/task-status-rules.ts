import type { TaskStatus } from "@/shared/types";

export const BLOCKED_REASON_MIN_LENGTH = 3;

export function normalizeBlockedReason(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getBlockedReasonValidationError(input: {
  currentStatus?: TaskStatus | null;
  currentBlockedReason?: string | null;
  nextStatus?: TaskStatus;
  nextBlockedReason?: string | null;
}): string | null {
  const nextStatus = input.nextStatus ?? input.currentStatus;
  if (nextStatus !== "blocked") return null;

  const reason = normalizeBlockedReason(
    input.nextBlockedReason !== undefined
      ? input.nextBlockedReason
      : input.currentBlockedReason,
  );

  if (!reason || reason.length < BLOCKED_REASON_MIN_LENGTH) {
    return "Для статуса «Заблокировано» укажите причину блокировки.";
  }

  return null;
}

export function normalizeTaskStatusPatch<T extends { status?: TaskStatus; blockedReason?: string | null }>(
  patch: T,
): T {
  if (patch.status === "blocked") {
    return {
      ...patch,
      blockedReason: normalizeBlockedReason(patch.blockedReason),
    };
  }

  if (patch.status) {
    return {
      ...patch,
      blockedReason: null,
    };
  }

  if (patch.blockedReason !== undefined) {
    return {
      ...patch,
      blockedReason: normalizeBlockedReason(patch.blockedReason),
    };
  }

  return patch;
}
