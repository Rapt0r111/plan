import { describe, expect, it } from "vitest";
import {
  filterUsersByComposition,
  getCompositionLabel,
  getUserComposition,
} from "@/shared/lib/personnel-composition";
import type { PersonnelComposition } from "@/shared/db/schema";
import type { UserWithMeta } from "@/shared/types";

function user(id: number, roleKey: string, composition?: PersonnelComposition): UserWithMeta {
  return {
    id,
    name: `User ${id}`,
    login: `user${id}`,
    roleId: id,
    initials: `U${id}`,
    createdAt: "2026-05-22T00:00:00.000Z",
    blockOrder: id,
    roleMeta: {
      id,
      key: roleKey,
      label: roleKey,
      short: roleKey.slice(0, 4).toUpperCase(),
      hex: "#8b5cf6",
      description: null,
      composition: (composition ?? null) as PersonnelComposition,
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

  it("uses explicit role composition before legacy role-key heuristics", () => {
    expect(getUserComposition(user(7, "company_commander", "variable"))).toBe("variable");
    expect(getUserComposition(user(8, "variable_operator", "permanent"))).toBe("permanent");
  });

  it("classifies future variable role keys without changing UI code", () => {
    expect(getUserComposition(user(4, "variable_operator"))).toBe("variable");
    expect(getUserComposition(user(5, "trainee_rotation_1"))).toBe("variable");
    expect(getUserComposition(user(6, "cadet_pool"))).toBe("variable");
  });

  it("filters users by composition while preserving original order", () => {
    const users = [
      user(1, "company_commander"),
      user(2, "variable_operator"),
      user(3, "platoon_2_commander"),
      user(4, "trainee_rotation_1"),
    ];

    expect(filterUsersByComposition(users, "permanent").map((item) => item.id)).toEqual([1, 3]);
    expect(filterUsersByComposition(users, "variable").map((item) => item.id)).toEqual([2, 4]);
  });

  it("keeps composition labels centralized", () => {
    expect(getCompositionLabel("permanent")).toBe("Постоянный состав");
    expect(getCompositionLabel("variable")).toBe("Переменный состав");
  });
});
