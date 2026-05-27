import type { UserWithMeta } from "@/shared/types";
import type { PersonnelComposition } from "@/shared/db/schema";

export type { PersonnelComposition };

export type CompositionScopedUser = Pick<UserWithMeta, "roleMeta">;

type CompositionMeta = {
  key: PersonnelComposition;
  label: string;
  description: string;
};

export const PERSONNEL_COMPOSITIONS: readonly CompositionMeta[] = [
  {
    key: "permanent",
    label: "Постоянный состав",
    description: "Пользователи постоянного состава.",
  },
  {
    key: "variable",
    label: "Переменный состав",
    description: "Пользователи переменного состава.",
  },
] as const;

export function isPersonnelComposition(value: unknown): value is PersonnelComposition {
  return value === "permanent" || value === "variable";
}

export function getCompositionLabel(composition: PersonnelComposition): string {
  return PERSONNEL_COMPOSITIONS.find((item) => item.key === composition)?.label ?? composition;
}

export function getUserComposition(user: CompositionScopedUser): PersonnelComposition {
  const groupKey = user.roleMeta.personnelGroup?.key;
  if (isPersonnelComposition(groupKey)) {
    return groupKey;
  }

  // Legacy fallback for rows created before personnel_groups existed.
  if (isPersonnelComposition(user.roleMeta.composition)) {
    return user.roleMeta.composition;
  }

  return "permanent";
}

export function getUserPersonnelGroupKey(user: CompositionScopedUser): string {
  return user.roleMeta.personnelGroup?.key ?? getUserComposition(user);
}

export function filterUsersByPersonnelGroup<T extends CompositionScopedUser>(
  users: readonly T[],
  groupKey: string,
): T[] {
  return users.filter((user) => getUserPersonnelGroupKey(user) === groupKey);
}

export function filterUsersByComposition<T extends CompositionScopedUser>(
  users: readonly T[],
  composition: PersonnelComposition,
): T[] {
  return users.filter((user) => getUserComposition(user) === composition);
}
