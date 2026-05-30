import { describe, expect, it } from "vitest";
import { hasLinkedProfile, requiresPasswordChange } from "@/shared/lib/auth-access";

describe("auth workspace access", () => {
  it("lets admins bootstrap workspace access without a linked personnel profile", () => {
    expect(hasLinkedProfile({ role: "admin", profileId: null })).toBe(true);
  });

  it("blocks regular members until an admin links a personnel profile", () => {
    expect(hasLinkedProfile({ role: "member", profileId: null })).toBe(false);
    expect(hasLinkedProfile({ role: "member", profileId: undefined })).toBe(false);
  });

  it("allows regular members after profile assignment", () => {
    expect(hasLinkedProfile({ role: "member", profileId: 12 })).toBe(true);
  });

  it("detects when a password change is required before access", () => {
    expect(requiresPasswordChange({ forcePasswordChange: true })).toBe(true);
    expect(requiresPasswordChange({ forcePasswordChange: false })).toBe(false);
    expect(requiresPasswordChange({})).toBe(false);
  });
});
