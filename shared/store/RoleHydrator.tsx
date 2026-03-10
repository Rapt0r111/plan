// Нужно создать: shared/store/RoleHydrator.tsx
"use client";
import { useEffect } from "react";
import { useRoleStore } from "./useRoleStore";
import type { DbRole } from "@/shared/types";

export function RoleHydrator({ roles }: { roles: DbRole[] }) {
  const hydrateRoles = useRoleStore((s) => s.hydrateRoles);
  useEffect(() => { hydrateRoles(roles); }, [roles, hydrateRoles]);
  return null;
}