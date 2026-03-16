"use client";
/**
 * @file RoleHydrator.tsx — shared/store
 *
 * ИСПРАВЛЕНИЕ v2 (откат render-time гидрации для Zustand):
 *
 * ПРОБЛЕМА render-time подхода:
 *   hydrateRoles() вызывает Zustand set() → синхронно оповещает всех
 *   подписчиков стора во время рендера RoleHydrator → React бросает:
 *   "Cannot update a component while rendering a different component"
 *
 * РЕШЕНИЕ: useEffect — гарантирует что React закончил рендер дерева
 * прежде чем Zustand обновит других подписчиков.
 *
 * ПРИМЕЧАНИЕ: React docs паттерн "setState during render" применим
 * ТОЛЬКО к локальному useState/useReducer в том же компоненте.
 * Для внешних сторов (Zustand, Redux, Jotai) — только useEffect.
 */
import { useEffect } from "react";
import { useRoleStore } from "./useRoleStore";
import type { DbRole } from "@/shared/types";

interface Props {
  roles: DbRole[];
}

export function RoleHydrator({ roles }: Props) {
  const hydrateRoles = useRoleStore((s) => s.hydrateRoles);

  useEffect(() => {
    if (roles.length > 0) {
      hydrateRoles(roles);
    }
  }, [roles, hydrateRoles]);

  return null;
}