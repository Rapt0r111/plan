// features/sync/useNotificationStore.ts
"use client";
import { create } from "zustand";

export type NotificationKind = "success" | "error" | "info" | "sync" | "zen";

export interface Notification {
  id:          string;
  kind:        NotificationKind;
  title:       string;
  body?:       string;
  icon?:       string;
  persistent?: boolean;
}

interface NotificationState {
  notification: Notification | null;
  expanded:     boolean;
  push:    (n: Omit<Notification, "id">) => void;
  dismiss: () => void;
  expand:  () => void;
  collapse:() => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notification: null,
  expanded:     false,

  push: (n) => set({
    notification: { ...n, id: crypto.randomUUID() },
    expanded: true,
  }),

  dismiss:  () => set({ notification: null, expanded: false }),
  expand:   () => set({ expanded: true }),
  collapse: () => set({ expanded: false }),
}));