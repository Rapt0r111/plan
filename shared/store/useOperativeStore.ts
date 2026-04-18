"use client";
/**
 * @file useOperativeStore.ts — shared/store
 *
 * v2 — добавлены deleteTask и deleteSubtask (admin only).
 *
 * Permissions:
 *   deleteTask / deleteSubtask: admin only (API тоже проверяет)
 *   Status toggle / subtask toggle: anyone
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

  addTask:       (params: { userId: number; title: string; description?: string | null; dueDate?: string | null }) => Promise<OperativeTaskView | null>;
  updateStatus:  (taskId: number, userId: number, status: OperativeTaskStatus) => Promise<void>;
  updateDueDate: (taskId: number, userId: number, dueDate: string | null) => Promise<void>;
  addSubtask:    (taskId: number, userId: number, title: string) => Promise<OperativeSubtaskView | null>;
  toggleSubtask: (taskId: number, userId: number, subtaskId: number, current: boolean) => Promise<void>;
  /** admin only — удалить задачу со всеми подзадачами */
  deleteTask:    (taskId: number, userId: number) => Promise<void>;
  /** admin only — удалить подзадачу */
  deleteSubtask: (taskId: number, userId: number, subtaskId: number) => Promise<void>;
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

  // ── updateStatus — open to EVERYONE ──────────────────────────────────────
  updateStatus: async (taskId, userId, status) => {
    const prev = get().getTask(taskId);
    if (!prev || prev.status === status) return;

    set((s) => ({
      userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => ({
        ...t,
        status,
        updatedAt: new Date().toISOString(),
      })),
    }));

    if (isOffline()) return;

    try {
      const res = await fetch(`/api/operative-tasks/${taskId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      set((s) => ({
        userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => ({
          ...t,
          status: prev.status,
        })),
      }));
    }
  },

  // ── updateDueDate — admin only ────────────────────────────────────────────
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

  // ── toggleSubtask — open to EVERYONE ─────────────────────────────────────
  toggleSubtask: async (taskId, userId, subtaskId, current) => {
    const newVal = !current;

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

  // ── deleteTask — admin only ───────────────────────────────────────────────
  deleteTask: async (taskId, userId) => {
    if (isOffline()) { notifyOfflineBlocked(); return; }

    // Snapshot для rollback
    const snapshot = get().userBlocks;

    // Оптимистичное удаление
    set((s) => ({
      userBlocks: s.userBlocks.map((block) =>
        block.user.id !== userId
          ? block
          : { ...block, tasks: block.tasks.filter((t) => t.id !== taskId) }
      ),
    }));

    try {
      const res = await fetch(`/api/operative-tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      // Rollback
      set({ userBlocks: snapshot });
      useNotificationStore.getState().push({
        kind:  "error",
        title: "Ошибка удаления",
        body:  err instanceof Error ? err.message : "Не удалось удалить задачу",
      });
    }
  },

  // ── deleteSubtask — admin only ────────────────────────────────────────────
  deleteSubtask: async (taskId, userId, subtaskId) => {
    if (isOffline()) { notifyOfflineBlocked(); return; }

    // Snapshot подзадач для rollback
    const prevTask = get().getTask(taskId);

    // Оптимистичное удаление
    set((s) => ({
      userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, (t) => {
        const newSubs = t.subtasks.filter((st) => st.id !== subtaskId);
        return {
          ...t,
          subtasks: newSubs,
          progress: { done: newSubs.filter((st) => st.isCompleted).length, total: newSubs.length },
        };
      }),
    }));

    try {
      const res = await fetch(`/api/operative-subtasks/${subtaskId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      // Rollback
      if (prevTask) {
        set((s) => ({
          userBlocks: updateTaskInBlocks(s.userBlocks, userId, taskId, () => prevTask),
        }));
      }
      useNotificationStore.getState().push({
        kind:  "error",
        title: "Ошибка удаления",
        body:  err instanceof Error ? err.message : "Не удалось удалить подзадачу",
      });
    }
  },
}));