export type AuthAccessUser = {
  role?: string | null;
  profileId?: number | null;
};

export function hasLinkedProfile(user: AuthAccessUser) {
  return user.role === "admin" || typeof user.profileId === "number";
}
