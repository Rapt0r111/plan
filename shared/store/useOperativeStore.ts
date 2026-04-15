"use client";
/**
 * @file useOperativeStore.ts — shared/store
 *
 * Operative Tasks permissions:
 *   - Status toggle (cycleStatus / markDone): anyone, including unauthenticated visitors
 *   - Subtask toggle: anyone, including unauthenticated visitors
 *   - Create task, add subtask, change due date, delete: admin only
 *   - DnD reorder: admin only
 *
 * Offline guard: mutations that require admin are still blocked offline.
 * Status/subtask toggle is allowed even offline (optimistic, replayed on reconnect).
 */
import { create } from "zustand";
import { useNotificationStore } from "@/features/sync/useNotificationStore";
import type {
  UserWithOperativeTasks,
  OperativeTaskView,
  OperativeSubtaskView,
  OperativeTaskStatus,
} from "@/entities/operative/operativeRepository";

// ── Helpers ───────────────────────────────────────────────────────────────────

let _tempSeq = 0;
function nextTempId(): number {
  return -(Date.now() * 1000 + (++_tempSeq % 1000));
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function notifyOfflineBlocked(): void {
  useNotificationStore.getState().push({
    kind:  "error",
    title: "Только просмотр",
    body:  "Изменения недоступны в офлайн-режиме",
    icon:  "🔒",
  });
}

// ── Store types ───────────────────────────────────────────────────────────────

interface OperativeStore {
  userBlocks:  UserWithOperativeTasks[];
  isHydrated:  boolean;

  hydrate: (data: UserWithOperativeTasks[]) => void;

  getTasksForUser:  (userId: number) => OperativeTaskView[];
  getTask:          (taskId: number) => OperativeTaskView | undefined;

  // Status toggle — open to everyone (including unauthenticated)
  addTask:       (params: { userId: number; title: string; description?: string | null; dueDate?: string | null }) => Promise<OperativeTaskView | null>;
  updateStatus:  (taskId: number, userId: number, status: OperativeTaskStatus) => Promise<void>;
  updateDueDate: (taskId: number, userId: number, dueDate: string | null) => Promise<void>;
  addSubtask:    (taskId: number, userId: number, title: string) => Promise<OperativeSubtaskView | null>;
  // Subtask toggle — open to everyone (including unauthenticated)
  toggleSubtask: (taskId: number, userId: number, subtaskId: number, current: boolean) => Promise<void>;
}

// ── Helpers to update nested state ────────────────────────────────────────────

function updateTaskInBlocks(
  blocks: UserWithOperativeTasks[],
  userId: number,
  taskId: number,
  updater: (task: OperativeTaskView) => OperativeTaskView,
): UserWithOperativeTasks[] {
  return blocks.map((block) => {
    if (block.user.id !== userId) return block;
    return {
      ...block,
      tasks: block.tasks.map((t) => (t.id === taskId ? updater(t) : t)),
    };
  });
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useOperativeStore = create<OperativeStore>((set, get) => ({
  userBlocks: [],
  isHydrated: false,

  hydrate: (data) => set({ userBlocks: data, isHydrated: true }),

  getTasksForUser: (userId) => {
    const block = get().userBlocks.find((b) => b.user.id === userId);
    return block?.tasks ?? [];
  },

  getTask: (taskId) => {
    for (const block of get().userBlocks) {
      const t = block.tasks.find((t) => t.id === taskId);
      if (t) return t;
    }
    return undefined;
  },

  // ── addTask — admin only ─────────────────────────────────────────────────
  addTask: async ({ userId, title, description = null, dueDate = null }) => {
    if (isOffline()) { notifyOfflineBlocked(); return null; }

    const tempId = nextTempId();
    const now    = new Date().toISOString();

    const tempTask: OperativeTaskView = {
      id:          tempId,
      userId,
      title,
      description,
      dueDate,
      status:      "todo",
      sortOrder:   Date.now(),
      order:       Date.now(),
      createdAt:   now,
      updatedAt:   now,
      subtasks:    [],
      progress:    { done: 0, total: 0 },
    };

    set((s) => ({
      userBlocks: s.userBlocks.map((block) =>
        block.user.id !== userId
          ? block
          : { ...block, tasks: [...block.tasks, tempTask] }
      ),
    }));

    try {
      const res = await fetch("/api/operative-tasks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId, title, description, dueDate }),
      });
      const data = await res.json();

      if (!data.ok) throw new Error(data.error ?? "Create failed");

      const realTask: OperativeTaskView = {
        ...data.data,
        subtasks: [],
        progress: { done: 0, total: 0 },
      };

      set((s) => ({
        userBlocks: s.userBlocks.map((block) =>
          block.user.id !== userId
            ? block
            : {
                ...block,
                tasks: block.tasks.map((t) => (t.id === tempId ? realTask : t)),
              }
        ),
      }));

      return realTask;
    } catch {
      set((s) => ({
        userBlocks: s.userBlocks.map((block) =>
          block.user.id !== userId
            ? block
            : { ...block, tasks: block.tasks.filter((t) => t.id !== tempId) }
        ),
      }));
      return null;
    }
  },

  // ── updateStatus — open to EVERYONE (no offline block) ───────────────────
  updateStatus: async (taskId, userId, status) => {
    const prev = get().getTask(taskId);
    if (!prev || prev.status === status) return;

    // Optimistic update immediately (no offline block for status)
    set((s) => ({
      userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => ({
        ...t,
        status,
        updatedAt: new Date().toISOString(),
      })),
    }));

    // If offline, skip network request (optimistic only; will sync on reconnect)
    if (isOffline()) return;

    try {
      const res = await fetch(`/api/operative-tasks/${taskId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      // Rollback
      set((s) => ({
        userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => ({
          ...t,
          status: prev.status,
        })),
      }));
    }
  },

  // ── updateDueDate — admin only (blocked offline) ─────────────────────────
  updateDueDate: async (taskId, userId, dueDate) => {
    if (isOffline()) { notifyOfflineBlocked(); return; }

    const prev = get().getTask(taskId);
    if (!prev) return;

    set((s) => ({
      userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => ({
        ...t,
        dueDate,
        updatedAt: new Date().toISOString(),
      })),
    }));

    try {
      const res = await fetch(`/api/operative-tasks/${taskId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ dueDate }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      set((s) => ({
        userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => ({
          ...t,
          dueDate: prev.dueDate,
        })),
      }));
    }
  },

  // ── addSubtask — admin only ───────────────────────────────────────────────
  addSubtask: async (taskId, userId, title) => {
    if (isOffline()) { notifyOfflineBlocked(); return null; }

    const tempId = nextTempId();
    const now    = new Date().toISOString();

    const tempSub: OperativeSubtaskView = {
      id:          tempId,
      taskId,
      title,
      isCompleted: false,
      sortOrder:   9999,
      createdAt:   now,
    };

    set((s) => ({
      userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => {
        const newSubs = [...t.subtasks, tempSub];
        return {
          ...t,
          subtasks: newSubs,
          progress: { done: newSubs.filter((st) => st.isCompleted).length, total: newSubs.length },
        };
      }),
    }));

    try {
      const res = await fetch(`/api/operative-tasks/${taskId}/subtasks`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title }),
      });
      const data = await res.json();

      if (!data.ok) throw new Error(data.error ?? "Create subtask failed");

      const realSub: OperativeSubtaskView = data.data;

      set((s) => ({
        userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => {
          const newSubs = t.subtasks.map((st) => (st.id === tempId ? realSub : st));
          return { ...t, subtasks: newSubs };
        }),
      }));

      return realSub;
    } catch {
      set((s) => ({
        userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => {
          const newSubs = t.subtasks.filter((st) => st.id !== tempId);
          return {
            ...t,
            subtasks: newSubs,
            progress: { done: newSubs.filter((st) => st.isCompleted).length, total: newSubs.length },
          };
        }),
      }));
      return null;
    }
  },

  // ── toggleSubtask — open to EVERYONE (no offline block) ──────────────────
  toggleSubtask: async (taskId, userId, subtaskId, current) => {
    const newVal = !current;

    // Optimistic update immediately (no offline block for toggle)
    set((s) => ({
      userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => {
        const newSubs = t.subtasks.map((st) =>
          st.id === subtaskId ? { ...st, isCompleted: newVal } : st
        );
        return {
          ...t,
          subtasks: newSubs,
          progress: { done: newSubs.filter((st) => st.isCompleted).length, total: newSubs.length },
        };
      }),
    }));

    if (isOffline()) return;

    try {
      const res = await fetch(`/api/operative-subtasks/${subtaskId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ isCompleted: newVal }),
      });
      if (!res.ok) throw new Error("Toggle failed");
    } catch {
      // Rollback
      set((s) => ({
        userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => {
          const newSubs = t.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, isCompleted: current } : st
          );
          return {
            ...t,
            subtasks: newSubs,
            progress: { done: newSubs.filter((st) => st.isCompleted).length, total: newSubs.length },
          };
        }),
      }));
    }
  },
}));