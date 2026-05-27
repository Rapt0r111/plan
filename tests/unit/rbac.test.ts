import { describe, expect, it } from "vitest";
import { hasPermission, parsePermissions } from "@/shared/lib/rbac";

describe("rbac helpers", () => {
  it("uses safe JSON permission parsing", () => {
    expect(parsePermissions('["management:read","bad"]')).toEqual(["management:read"]);
    expect(parsePermissions("not-json")).toEqual([]);
  });

  it("falls back to SaaS default role permissions", () => {
    expect(hasPermission({ authRole: "admin", permission: "settings:manage" })).toBe(true);
    expect(hasPermission({ authRole: "member", permission: "settings:manage" })).toBe(false);
    expect(hasPermission({ authRole: "member", permission: "management:read" })).toBe(true);
  });
});
