export const ROLE_PERMISSIONS = [
  "management:read",
  "reports:export",
  "settings:manage",
  "users:manage",
  "tasks:manage",
  "audit:read",
] as const;

export type RolePermission = (typeof ROLE_PERMISSIONS)[number];

export const ADMIN_PERMISSIONS: RolePermission[] = [...ROLE_PERMISSIONS];
export const MEMBER_PERMISSIONS: RolePermission[] = [
  "management:read",
  "reports:export",
  "tasks:manage",
];

export function getDefaultPermissions(role: string | null | undefined): RolePermission[] {
  return role === "admin" ? ADMIN_PERMISSIONS : MEMBER_PERMISSIONS;
}

export function parsePermissions(value: string | null | undefined): RolePermission[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RolePermission =>
      typeof item === "string" && ROLE_PERMISSIONS.includes(item as RolePermission)
    );
  } catch {
    return [];
  }
}

export function hasPermission(params: {
  authRole?: string | null;
  permissionsJson?: string | null;
  permission: RolePermission;
}) {
  const explicit = parsePermissions(params.permissionsJson);
  const permissions = explicit.length > 0 ? explicit : getDefaultPermissions(params.authRole);
  return permissions.includes(params.permission);
}
