/**
 * @file RoleHydrator.tsx — shared/store
 *
 * Server → Client bridge для ролей.
 * Монтируется в app/(main)/layout.tsx рядом с SidebarLoader.
 *
 * ПОЧЕМУ НЕ useEffect:
 *   Данные уже есть на сервере. useEffect добавит лишний рендер-цикл.
 *   Вместо этого используем паттерн "hydrate on mount" через ref.
 *
 * ВАЖНО: Компонент рендерит null, он только синхронизирует стор.
 */
"use client";
import { useRef } from "react";
import { useRoleStore } from "./useRoleStore";
import type { DbRole } from "@/shared/types";

interface Props {
  roles: DbRole[];
}

export function RoleHydrator({ roles }: Props) {
  const hydrateRoles = useRoleStore((s) => s.hydrateRoles);
  const hydratedRef  = useRef(false);

  // Синхронная гидрация — до первого рендера дочерних компонентов
  if (!hydratedRef.current) {
    hydrateRoles(roles);
    hydratedRef.current = true;
  }

  return null;
}