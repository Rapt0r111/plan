export type AuthAccessUser = {
  role?: string | null;
  profileId?: number | null;
  forcePasswordChange?: boolean | null;
};

export function hasLinkedProfile(user: AuthAccessUser) {
  return user.role === "admin" || typeof user.profileId === "number";
}

export function requiresPasswordChange(user: AuthAccessUser) {
  return user.forcePasswordChange === true;
}
