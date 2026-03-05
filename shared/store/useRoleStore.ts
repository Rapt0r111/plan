/**
 * @file useRoleStore.ts — shared/store
 *
 * Thin Zustand slice для ролей.
 *
 * ПАТТЕРН:
 *   hydrateRoles()  — вызывается из RoleHydrator (Server → Client bridge)
 *   getRoleByKey()  — синхронный lookup для компонентов
 *   optimistic CRUD — create/update/delete с rollback
 *
 * НЕ ХРАНИТ: Tailwind-классы. Только данные из БД.
 */
"use client";
import { create } from "zustand";
import type { DbRole } from "@/shared/types";

interface RoleStore {
  roles:    DbRole[];
  hydrated: boolean;

  // Read
  getRoleByKey: (key: string) => DbRole | undefined;
  getRoleById:  (id: number)  => DbRole | undefined;

  // Lifecycle
  hydrateRoles: (roles: DbRole[]) => void;

  // Optimistic mutations
  optimisticCreate: (role: DbRole) => void;
  optimisticUpdate: (id: number, patch: Partial<DbRole>) => void;
  optimisticDelete: (id: number) => void;
  rollbackRoles:    (snapshot: DbRole[]) => void;
}

export const useRoleStore = create<RoleStore>((set, get) => ({
  roles:    [],
  hydrated: false,

  getRoleByKey: (key) => get().roles.find((r) => r.key === key),
  getRoleById:  (id)  => get().roles.find((r) => r.id === id),

  hydrateRoles: (roles) => set({ roles, hydrated: true }),

  optimisticCreate: (role) =>
    set((s) => ({ roles: [...s.roles, role].sort((a, b) => a.sortOrder - b.sortOrder) })),

  optimisticUpdate: (id, patch) =>
    set((s) => ({
      roles: s.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  optimisticDelete: (id) =>
    set((s) => ({ roles: s.roles.filter((r) => r.id !== id) })),

  rollbackRoles: (snapshot) => set({ roles: snapshot }),
}));