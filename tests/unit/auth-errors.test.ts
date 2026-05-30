import { describe, expect, it } from "vitest";
import { authErrorToResponse } from "@/shared/lib/auth-errors";

describe("auth error mapping", () => {
  it("maps forced password change to a locked response", () => {
    expect(authErrorToResponse(new Error("PASSWORD_CHANGE_REQUIRED"))).toEqual({
      status: 423,
      message: "Password change required",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  });
});
