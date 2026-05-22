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

const PERMANENT_ROLE_KEYS = new Set([
  "company_commander",
  "platoon_1_commander",
  "platoon_2_commander",
  "deputy_platoon_1",
  "deputy_platoon_2",
  "sergeant_major",
  "squad_commander_2",
]);

const VARIABLE_ROLE_KEY_HINTS = [
  "variable",
  "trainee",
  "cadet",
  "student",
  "listener",
  "rotation",
  "pool",
  "перем",
  "курсант",
  "слушател",
];

export function isPersonnelComposition(value: unknown): value is PersonnelComposition {
  return value === "permanent" || value === "variable";
}

export function getCompositionLabel(composition: PersonnelComposition): string {
  return PERSONNEL_COMPOSITIONS.find((item) => item.key === composition)?.label ?? composition;
}

export function getUserComposition(user: CompositionScopedUser): PersonnelComposition {
  if (isPersonnelComposition(user.roleMeta.composition)) {
    return user.roleMeta.composition;
  }

  const roleKey = user.roleMeta.key.toLowerCase();
  const roleText = [
    user.roleMeta.key,
    user.roleMeta.label,
    user.roleMeta.short,
    user.roleMeta.description ?? "",
  ].join(" ").toLowerCase();

  if (PERMANENT_ROLE_KEYS.has(roleKey)) {
    return "permanent";
  }

  if (VARIABLE_ROLE_KEY_HINTS.some((hint) => roleText.includes(hint))) {
    return "variable";
  }

  return "permanent";
}

export function filterUsersByComposition<T extends CompositionScopedUser>(
  users: readonly T[],
  composition: PersonnelComposition,
): T[] {
  return users.filter((user) => getUserComposition(user) === composition);
}
