import { describe, expect, it } from "vitest";
import {
  DEFAULT_VARIABLE_PERSONNEL_PASSWORD,
  VARIABLE_PERSONNEL,
} from "@/shared/db/variable-personnel";

describe("variable personnel seed list", () => {
  it("contains all requested accounts with stable unique logins", () => {
    expect(VARIABLE_PERSONNEL).toHaveLength(40);
    expect(new Set(VARIABLE_PERSONNEL.map((person) => person.login)).size).toBe(
      VARIABLE_PERSONNEL.length,
    );
    expect(VARIABLE_PERSONNEL.every((person) => person.initials.length <= 2)).toBe(true);
  });

  it("uses the requested temporary password", () => {
    expect(DEFAULT_VARIABLE_PERSONNEL_PASSWORD).toBe("12345678");
  });
});
