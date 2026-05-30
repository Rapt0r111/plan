export function authErrorToResponse(error: unknown): { status: number; message: string; code?: string } | null {
  const msg = String(error);
  if (msg.includes("UNAUTHORIZED")) return { status: 401, message: "Unauthorized", code: "UNAUTHORIZED" };
  if (msg.includes("PASSWORD_CHANGE_REQUIRED")) return { status: 423, message: "Password change required", code: "PASSWORD_CHANGE_REQUIRED" };
  if (msg.includes("PROFILE_REQUIRED")) return { status: 403, message: "Profile assignment required", code: "PROFILE_REQUIRED" };
  if (msg.includes("ACCESS_DENIED")) return { status: 403, message: "Access denied", code: "ACCESS_DENIED" };
  if (msg.includes("FORBIDDEN")) return { status: 403, message: "Forbidden: requires admin role", code: "FORBIDDEN" };
  return null;
}
