import { describe, expect, it } from "vitest";
import {
  filterUsersByComposition,
  getCompositionLabel,
  getUserComposition,
} from "@/shared/lib/personnel-composition";
import type { PersonnelComposition } from "@/shared/db/schema";
import type { DbPersonnelGroup, UserWithMeta } from "@/shared/types";

function personnelGroup(id: number, key: string, label = key): DbPersonnelGroup {
  return {
    id,
    key,
    label,
    description: null,
    color: "#8b5cf6",
    sortOrder: id,
    isActive: true,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
  };
}

function user(
  id: number,
  roleKey: string,
  composition: PersonnelComposition = "permanent",
  group?: DbPersonnelGroup | null,
): UserWithMeta {
  return {
    id,
    name: `User ${id}`,
    login: `user${id}`,
    roleId: id,
    initials: `U${id}`,
    authUserId: null,
    accountStatus: "invited",
    legacyLoginAlias: null,
    createdAt: "2026-05-22T00:00:00.000Z",
    blockOrder: id,
    roleMeta: {
      id,
      key: roleKey,
      label: roleKey,
      short: roleKey.slice(0, 4).toUpperCase(),
      hex: "#8b5cf6",
      description: null,
      composition,
      personnelGroupId: group?.id ?? null,
      personnelGroup: group,
      permissionsJson: "[]",
      sortOrder: id,
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
    },
  };
}

describe("personnel composition", () => {
  it("classifies seeded command roles as permanent composition", () => {
    expect(getUserComposition(user(1, "company_commander"))).toBe("permanent");
    expect(getUserComposition(user(2, "platoon_1_commander"))).toBe("permanent");
    expect(getUserComposition(user(3, "squad_commander_2"))).toBe("permanent");
  });

  it("uses personnel group before legacy role composition", () => {
    const variableGroup = personnelGroup(2, "variable", "Variable");

    expect(getUserComposition(user(7, "company_commander", "permanent", variableGroup))).toBe("variable");
  });

  it("uses legacy role composition when group is absent", () => {
    expect(getUserComposition(user(7, "company_commander", "variable"))).toBe("variable");
    expect(getUserComposition(user(8, "variable_operator", "permanent"))).toBe("permanent");
  });

  it("does not classify by role-key heuristics anymore", () => {
    expect(getUserComposition(user(4, "variable_operator"))).toBe("permanent");
    expect(getUserComposition(user(5, "trainee_rotation_1"))).toBe("permanent");
    expect(getUserComposition(user(6, "cadet_pool"))).toBe("permanent");
  });

  it("filters users by composition while preserving original order", () => {
    const variableGroup = personnelGroup(2, "variable", "Variable");
    const users = [
      user(1, "company_commander"),
      user(2, "variable_operator", "permanent", variableGroup),
      user(3, "platoon_2_commander"),
      user(4, "trainee_rotation_1", "variable"),
    ];

    expect(filterUsersByComposition(users, "permanent").map((item) => item.id)).toEqual([1, 3]);
    expect(filterUsersByComposition(users, "variable").map((item) => item.id)).toEqual([2, 4]);
  });

  it("keeps composition labels centralized", () => {
    expect(getCompositionLabel("permanent")).toBe("Постоянный состав");
    expect(getCompositionLabel("variable")).toBe("Переменный состав");
  });
});
