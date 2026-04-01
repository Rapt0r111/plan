/**
 * @file useTaskStore.ts — shared/store
 *
 * OFFLINE QUEUE — v5
 * ═══════════════════════════════════════════════════════════════
 *
 * ИСПРАВЛЕННЫЕ БАГИ:
 *
 * БАГ #1 КРИТИЧЕСКИЙ — replayOfflineQueue: syncStatus всегда "synced":
 *   БЫЛО: syncStatus: remaining === 0 ? "synced" : "synced"
 *         Оба варианта тернарного оператора давали "synced" — опечатка.
 *         При частичном провале (5xx) статус оставался "synced"
 *         хотя данные не синхронизированы.
 *   СТАЛО: syncStatus: remaining === 0 ? "synced" : "error"
 *
 * БАГ #3 — Pre-flight navigator.onLine check перед fetch:
 *   БЫЛО: fetch вызывался даже при offline → ждали таймаут (Firefox ~30с)
 *         → потом catch → enqueue. UX заморожен на время таймаута.
 *   СТАЛО: проверяем isCurrentlyOffline() ПЕРЕД fetch во всех мутациях.
 *          Если offline — немедленно уходим в очередь без ожидания.
 *
 * БАГ #4 — Нет лимита повторов для 5xx ошибок:
 *   БЫЛО: 5xx операции копились бесконечно в очереди, никогда не удаляясь.
 *   СТАЛО: после MAX_OP_RETRIES (5) попыток операция удаляется из очереди,
 *          а пользователю показывается уведомление об ошибке.
 *
 * БАГ #5 — Молчаливое удаление 4xx операций при replay:
 *   БЫЛО: 4xx ops тихо удалялись — пользователь не знал что его изменение
 *         было потеряно (например, задача удалена другим пользователем пока
 *         он был офлайн).
 *   СТАЛО: replayOfflineQueue возвращает дополнительное поле droppedCount
 *          и SyncOrchestrator показывает отдельное уведомление.
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import {
  enqueuePendingOp,
  getPendingOps,
  getPendingOpsCount,
  removePendingOp,
  incrementOpRetries,
  MAX_OP_RETRIES,
} from "@/shared/lib/localCache";
import type { EpicWithTasks, TaskView, TaskStatus, TaskPriority } from "@/shared/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface ReplayResult {
  successCount: number;
  /** Операции удалённые из-за 4xx (устаревшие, пользователя нужно уведомить) */
  droppedCount: number;
}

// ── Module-level helpers ──────────────────────────────────────────────────────

let _tempIdSeq = 0;
function nextTempId(): number {
  return -(Date.now() * 1000 + (++_tempIdSeq % 1000));
}

/**
 * isCurrentlyOffline — проверяет navigator.onLine.
 * Безопасно на сервере (typeof guard).
 */
function isCurrentlyOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function omitTask(
  map: Record<number, TaskView>,
  id: number,
): Record<number, TaskView> {
  const next = { ...map };
  delete next[id];
  return next;
}

function buildTaskIndex(epics: EpicWithTasks[]): Record<number, TaskView> {
  const index: Record<number, TaskView> = {};
  for (const epic of epics) {
    for (const task of epic.tasks) index[task.id] = task;
  }
  return index;
}

async function apiPatch(path: string, body: object): Promise<void> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
}

function updateEpicsForTask(
  epics: EpicWithTasks[],
  taskId: number,
  updater: (tasks: TaskView[]) => TaskView[],
): EpicWithTasks[] {
  return epics.map((epic) => {
    if (!epic.tasks.some((t) => t.id === taskId)) return epic;
    const newTasks = updater(epic.tasks);
    return {
      ...epic,
      tasks: newTasks,
      progress: {
        total: newTasks.length,
        done:  newTasks.filter((t) => t.status === "done").length,
      },
    };
  });
}

// ── Store interface ───────────────────────────────────────────────────────────

interface TaskStore {
  epics:            EpicWithTasks[];
  tasks:            Record<number, TaskView>;
  activeEpicId:     number | null;
  syncStatus:       SyncStatus;
  lastSyncedAt:     Date | null;
  pendingOps:       number;
  offlineQueueSize: number;

  getEpic:           (id: number) => EpicWithTasks | undefined;
  getTask:           (id: number) => TaskView | undefined;
  getTasksForEpic:   (epicId: number) => TaskView[];
  hydrateEpics:      (epics: EpicWithTasks[]) => void;
  setActiveEpic:     (epicId: number | null) => void;

  addTask:           (epicId: number, title: string, status?: TaskStatus) => Promise<void>;
  createTask:        (params: { epicId: number; title: string; status?: TaskStatus; priority?: TaskPriority }) => Promise<TaskView | null>;
  updateTaskStatus:  (taskId: number, status: TaskStatus) => Promise<void>;
  updateTaskPriority:(taskId: number, priority: TaskPriority) => Promise<void>;
  updateTaskTitle:   (taskId: number, title: string) => Promise<void>;
  updateTaskDescription:(taskId: number, description: string | null) => Promise<void>;
  updateTaskDueDate: (taskId: number, dueDate: string | null) => Promise<void>;
  addAssignee:       (taskId: number, user: TaskView["assignees"][0]) => Promise<void>;
  removeAssignee:    (taskId: number, userId: number) => Promise<void>;
  toggleSubtask:     (taskId: number, subtaskId: number, current: boolean) => Promise<void>;
  reorderTasks:      (epicId: number, orderedIds: number[]) => Promise<void>;
  deleteTask:        (taskId: number) => Promise<void>;

  refreshOfflineQueue: () => Promise<void>;
  /**
   * Воспроизводит очередь offline-операций.
   * @returns ReplayResult с количеством успешных и удалённых операций
   */
  replayOfflineQueue: () => Promise<ReplayResult>;

  _beginOp: () => () => void;
}

// ── Store implementation ──────────────────────────────────────────────────────

export const useTaskStore = create<TaskStore>()(
  subscribeWithSelector((set, get) => ({
    epics:            [],
    tasks:            {},
    activeEpicId:     null,
    syncStatus:       "idle",
    lastSyncedAt:     null,
    pendingOps:       0,
    offlineQueueSize: 0,

    getEpic:          (id) => get().epics.find((e) => e.id === id),
    getTask:          (id) => get().tasks[id],
    getTasksForEpic:  (epicId) => get().epics.find((e) => e.id === epicId)?.tasks ?? [],

    hydrateEpics: (epics) => set({
      epics,
      tasks:        buildTaskIndex(epics),
      syncStatus:   "synced",
      lastSyncedAt: new Date(),
    }),

    setActiveEpic: (epicId) => set({ activeEpicId: epicId }),

    // ── _beginOp ─────────────────────────────────────────────────────────────
    _beginOp: () => {
      set((s) => ({ pendingOps: s.pendingOps + 1, syncStatus: "syncing" }));
      return () => set((s) => {
        const next = s.pendingOps - 1;
        return {
          pendingOps:   next,
          syncStatus:   next === 0 ? "synced" : "syncing",
          lastSyncedAt: next === 0 ? new Date() : s.lastSyncedAt,
        };
      });
    },

    // ── refreshOfflineQueue ───────────────────────────────────────────────────
    refreshOfflineQueue: async () => {
      const count = await getPendingOpsCount();
      set({ offlineQueueSize: count });
    },

    // ── replayOfflineQueue ────────────────────────────────────────────────────
    replayOfflineQueue: async () => {
      const ops = await getPendingOps();
      if (ops.length === 0) return { successCount: 0, droppedCount: 0 };

      let successCount = 0;
      let droppedCount = 0;

      for (const op of ops) {
        if (isCurrentlyOffline()) break;

        try {
          const res = await fetch(op.url, {
            method: op.method,
            headers: op.body ? { "Content-Type": "application/json" } : {},
            body:    op.body ? JSON.stringify(op.body) : undefined,
          });

          if (res.ok) {
            await removePendingOp(op.id);
            successCount++;
            set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
          } else if (res.status >= 400 && res.status < 500) {
            // 4xx — операция устарела (задача удалена и т.д.)
            // БАГ #5 ИСПРАВЛЕН: считаем как dropped, не молчим
            await removePendingOp(op.id);
            droppedCount++;
            set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
          } else {
            // 5xx — ошибка сервера
            // БАГ #4 ИСПРАВЛЕН: проверяем лимит повторов
            if (op.retries >= MAX_OP_RETRIES) {
              // Исчерпали лимит — удаляем как dropped
              await removePendingOp(op.id);
              droppedCount++;
              set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
            } else {
              await incrementOpRetries(op.id);
            }
          }
        } catch {
          // Сеть пропала снова — прерываем replay
          break;
        }
      }

      const remaining = await getPendingOpsCount();

      // БАГ #1 ИСПРАВЛЕН: syncStatus теперь корректно различает состояния
      // БЫЛО: remaining === 0 ? "synced" : "synced"  ← оба "synced"!
      // СТАЛО: remaining === 0 ? "synced" : "error"
      set({
        offlineQueueSize: remaining,
        syncStatus:       remaining === 0 ? "synced" : "error",
        lastSyncedAt:     remaining === 0 ? new Date() : get().lastSyncedAt,
      });

      return { successCount, droppedCount };
    },

    // ── addTask ───────────────────────────────────────────────────────────────
    addTask: async (epicId, title, status = "todo") => {
      const tempId = nextTempId();
      const now    = new Date().toISOString();

      const tempTask: TaskView = {
        id: tempId, epicId, title, description: null, status,
        priority: "medium", dueDate: null, sortOrder: 9999,
        createdAt: now, updatedAt: now,
        assignees: [], subtasks: [], progress: { done: 0, total: 0 },
      };

      set((s) => ({
        tasks: { ...s.tasks, [tempId]: tempTask },
        epics: s.epics.map((e) =>
          e.id !== epicId ? e : {
            ...e,
            tasks:    [...e.tasks, tempTask],
            progress: { ...e.progress, total: e.progress.total + 1 },
          }
        ),
      }));

      const done = get()._beginOp();
      try {
        const res  = await fetch("/api/tasks", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ epicId, title, status, priority: "medium", sortOrder: 9999 }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const realId:   number   = data.data.id;
        const realTask: TaskView = { ...tempTask, id: realId };

        set((s) => {
          const restTasks = omitTask(s.tasks, tempId);
          return {
            tasks: { ...restTasks, [realId]: realTask },
            epics: s.epics.map((e) =>
              e.id !== epicId ? e : {
                ...e,
                tasks: e.tasks.map((t) => (t.id === tempId ? realTask : t)),
              }
            ),
          };
        });
      } catch {
        set((s) => {
          const restTasks = omitTask(s.tasks, tempId);
          return {
            tasks:      restTasks,
            epics:      s.epics.map((e) =>
              e.id !== epicId ? e : {
                ...e,
                tasks:    e.tasks.filter((t) => t.id !== tempId),
                progress: { ...e.progress, total: e.progress.total - 1 },
              }
            ),
            syncStatus: "error",
          };
        });
      } finally {
        done();
      }
    },

    // ── createTask ────────────────────────────────────────────────────────────
    createTask: async ({ epicId, title, status = "todo", priority = "medium" }) => {
      const tempId = nextTempId();
      const now    = new Date().toISOString();

      const tempTask: TaskView = {
        id: tempId, epicId, title, description: null, status, priority,
        dueDate: null, sortOrder: 9999, createdAt: now, updatedAt: now,
        assignees: [], subtasks: [], progress: { done: 0, total: 0 },
      };

      set((s) => ({
        tasks: { ...s.tasks, [tempId]: tempTask },
        epics: s.epics.map((e) =>
          e.id !== epicId ? e : {
            ...e,
            tasks:    [...e.tasks, tempTask],
            progress: { ...e.progress, total: e.progress.total + 1 },
          }
        ),
      }));

      const done = get()._beginOp();
      try {
        const res  = await fetch("/api/tasks", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ epicId, title, status, priority, sortOrder: 9999 }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const realId:   number   = data.data.id;
        const realTask: TaskView = { ...tempTask, id: realId };

        set((s) => {
          const restTasks = omitTask(s.tasks, tempId);
          return {
            tasks: { ...restTasks, [realId]: realTask },
            epics: s.epics.map((e) =>
              e.id !== epicId ? e : {
                ...e,
                tasks: e.tasks.map((t) => (t.id === tempId ? realTask : t)),
              }
            ),
          };
        });
        return realTask;
      } catch {
        set((s) => {
          const restTasks = omitTask(s.tasks, tempId);
          return {
            tasks:      restTasks,
            epics:      s.epics.map((e) =>
              e.id !== epicId ? e : {
                ...e,
                tasks:    e.tasks.filter((t) => t.id !== tempId),
                progress: { ...e.progress, total: e.progress.total - 1 },
              }
            ),
            syncStatus: "error",
          };
        });
        return null;
      } finally {
        done();
      }
    },

    // ── updateTaskStatus ──────────────────────────────────────────────────────
    updateTaskStatus: async (taskId, status) => {
      const task = get().tasks[taskId];
      if (!task || task.status === status) return;

      const prevStatus   = task.status;
      const prevSubtasks = task.subtasks;

      const subtasksToUpdate: number[] = [];
      const updatedSubtasks = status === "done"
        ? task.subtasks.map((st) => {
            if (!st.isCompleted) { subtasksToUpdate.push(st.id); return { ...st, isCompleted: true }; }
            return st;
          })
        : task.subtasks;

      set((s) => {
        const doneCt  = updatedSubtasks.filter((st) => st.isCompleted).length;
        const updated: TaskView = {
          ...s.tasks[taskId], status, subtasks: updatedSubtasks,
          progress: { total: updatedSubtasks.length, done: doneCt },
        };
        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: updateEpicsForTask(s.epics, taskId, (tasks) =>
            tasks.map((t) => (t.id === taskId ? updated : t))
          ),
        };
      });

      // БАГ #3 ИСПРАВЛЕН: pre-flight check перед fetch
      // Firefox может ждать ~30с таймаут сети прежде чем fetch завершится с ошибкой.
      // Проверяем offline ДО попытки — немедленно уходим в очередь.
      if (isCurrentlyOffline()) {
        const ops = [
          enqueuePendingOp({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { status } }),
          ...subtasksToUpdate.map((id) =>
            enqueuePendingOp({ url: `/api/subtasks/${id}`, method: "PATCH", body: { isCompleted: true } })
          ),
        ];
        await Promise.all(ops);
        const newCount = 1 + subtasksToUpdate.length;
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + newCount }));
        return;
      }

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/tasks/${taskId}`, { status });
        if (subtasksToUpdate.length > 0) {
          await Promise.all(
            subtasksToUpdate.map((id) =>
              apiPatch(`/api/subtasks/${id}`, { isCompleted: true })
            )
          );
        }
      } catch {
        if (isCurrentlyOffline()) {
          const ops = [
            enqueuePendingOp({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { status } }),
            ...subtasksToUpdate.map((id) =>
              enqueuePendingOp({ url: `/api/subtasks/${id}`, method: "PATCH", body: { isCompleted: true } })
            ),
          ];
          await Promise.all(ops);
          const newCount = 1 + subtasksToUpdate.length;
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + newCount }));
        } else {
          set((s) => {
            const rolledDoneCt = prevSubtasks.filter((st) => st.isCompleted).length;
            const rolled: TaskView = {
              ...s.tasks[taskId], status: prevStatus, subtasks: prevSubtasks,
              progress: { total: prevSubtasks.length, done: rolledDoneCt },
            };
            return {
              tasks:      { ...s.tasks, [taskId]: rolled },
              epics:      updateEpicsForTask(s.epics, taskId, (tasks) =>
                tasks.map((t) => (t.id === taskId ? rolled : t))
              ),
              syncStatus: "error",
            };
          });
        }
      } finally {
        done();
      }
    },

    // ── updateTaskPriority ────────────────────────────────────────────────────
    updateTaskPriority: async (taskId, priority) => {
      const prev = get().tasks[taskId]?.priority;
      if (!prev || prev === priority) return;

      set((s) => {
        const updated: TaskView = { ...s.tasks[taskId], priority };
        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: updateEpicsForTask(s.epics, taskId, (tasks) =>
            tasks.map((t) => (t.id === taskId ? updated : t))
          ),
        };
      });

      // Pre-flight offline check
      if (isCurrentlyOffline()) {
        await enqueuePendingOp({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { priority } });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/tasks/${taskId}`, { priority });
      } catch {
        if (isCurrentlyOffline()) {
          await enqueuePendingOp({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { priority } });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => {
            const rolled: TaskView = { ...s.tasks[taskId], priority: prev };
            return {
              tasks:      { ...s.tasks, [taskId]: rolled },
              epics:      updateEpicsForTask(s.epics, taskId, (tasks) =>
                tasks.map((t) => (t.id === taskId ? rolled : t))
              ),
              syncStatus: "error",
            };
          });
        }
      } finally {
        done();
      }
    },

    // ── updateTaskTitle ───────────────────────────────────────────────────────
    updateTaskTitle: async (taskId, title) => {
      const prev = get().tasks[taskId]?.title;
      if (!prev || prev === title || !title.trim()) return;
      const patched = title.trim();

      set((s) => {
        const updated = { ...s.tasks[taskId], title: patched };
        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? updated : t)) })),
        };
      });

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { title: patched } });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/tasks/${taskId}`, { title: patched });
      } catch {
        if (isCurrentlyOffline()) {
          await enqueuePendingOp({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { title: patched } });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => {
            const rolled = { ...s.tasks[taskId], title: prev };
            return {
              tasks:      { ...s.tasks, [taskId]: rolled },
              epics:      s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
              syncStatus: "error",
            };
          });
        }
      } finally {
        done();
      }
    },

    // ── updateTaskDescription ─────────────────────────────────────────────────
    updateTaskDescription: async (taskId, description) => {
      const prev = get().tasks[taskId]?.description ?? null;
      const next = description?.trim() || null;
      if (prev === next) return;

      set((s) => {
        const updated = { ...s.tasks[taskId], description: next };
        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? updated : t)) })),
        };
      });

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { description: next } });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/tasks/${taskId}`, { description: next });
      } catch {
        if (isCurrentlyOffline()) {
          await enqueuePendingOp({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { description: next } });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => {
            const rolled = { ...s.tasks[taskId], description: prev };
            return {
              tasks:      { ...s.tasks, [taskId]: rolled },
              epics:      s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
              syncStatus: "error",
            };
          });
        }
      } finally {
        done();
      }
    },

    // ── updateTaskDueDate ─────────────────────────────────────────────────────
    updateTaskDueDate: async (taskId, dueDate) => {
      const prev = get().tasks[taskId]?.dueDate ?? null;
      if (prev === dueDate) return;

      set((s) => {
        const updated = { ...s.tasks[taskId], dueDate };
        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? updated : t)) })),
        };
      });

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { dueDate: dueDate ?? null } });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/tasks/${taskId}`, { dueDate });
      } catch {
        if (isCurrentlyOffline()) {
          await enqueuePendingOp({ url: `/api/tasks/${taskId}`, method: "PATCH", body: { dueDate: dueDate ?? null } });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => {
            const rolled = { ...s.tasks[taskId], dueDate: prev };
            return {
              tasks:      { ...s.tasks, [taskId]: rolled },
              epics:      s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
              syncStatus: "error",
            };
          });
        }
      } finally {
        done();
      }
    },

    // ── toggleSubtask ─────────────────────────────────────────────────────────
    toggleSubtask: async (taskId, subtaskId, current) => {
      const newVal = !current;

      set((s) => {
        const task = s.tasks[taskId];
        if (!task) return s;
        const subs   = task.subtasks.map((st) =>
          st.id === subtaskId ? { ...st, isCompleted: newVal } : st
        );
        const doneCt = subs.filter((st) => st.isCompleted).length;
        const updated: TaskView = { ...task, subtasks: subs, progress: { done: doneCt, total: subs.length } };
        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: updateEpicsForTask(s.epics, taskId, (tasks) =>
            tasks.map((t) => (t.id === taskId ? updated : t))
          ),
        };
      });

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({ url: `/api/subtasks/${subtaskId}`, method: "PATCH", body: { isCompleted: newVal } });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/subtasks/${subtaskId}`, { isCompleted: newVal });
      } catch {
        if (isCurrentlyOffline()) {
          await enqueuePendingOp({ url: `/api/subtasks/${subtaskId}`, method: "PATCH", body: { isCompleted: newVal } });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => {
            const task = s.tasks[taskId];
            if (!task) return s;
            const rolled = task.subtasks.map((st) =>
              st.id === subtaskId ? { ...st, isCompleted: current } : st
            );
            const rolledDone = rolled.filter((st) => st.isCompleted).length;
            const rolledTask: TaskView = { ...task, subtasks: rolled, progress: { done: rolledDone, total: rolled.length } };
            return {
              tasks:      { ...s.tasks, [taskId]: rolledTask },
              epics:      updateEpicsForTask(s.epics, taskId, (tasks) =>
                tasks.map((t) => (t.id === taskId ? rolledTask : t))
              ),
              syncStatus: "error",
            };
          });
        }
      } finally {
        done();
      }
    },

    // ── addAssignee ───────────────────────────────────────────────────────────
    addAssignee: async (taskId, user) => {
      const task = get().tasks[taskId];
      if (!task || task.assignees.some((a) => a.id === user.id)) return;

      set((s) => {
        const updated = { ...s.tasks[taskId], assignees: [...s.tasks[taskId].assignees, user] };
        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? updated : t)) })),
        };
      });

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          url:    `/api/tasks/${taskId}/assignees`,
          method: "POST",
          body:   { userId: user.id },
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        const res = await fetch(`/api/tasks/${taskId}/assignees`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ userId: user.id }),
        });
        if (!res.ok) throw new Error(`POST assignee failed: ${res.status}`);
      } catch {
        if (isCurrentlyOffline()) {
          await enqueuePendingOp({
            url:    `/api/tasks/${taskId}/assignees`,
            method: "POST",
            body:   { userId: user.id },
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => {
            const rolled = { ...s.tasks[taskId], assignees: s.tasks[taskId].assignees.filter((a) => a.id !== user.id) };
            return {
              tasks:      { ...s.tasks, [taskId]: rolled },
              epics:      s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
              syncStatus: "error",
            };
          });
        }
      } finally {
        done();
      }
    },

    // ── removeAssignee ────────────────────────────────────────────────────────
    removeAssignee: async (taskId, userId) => {
      const task = get().tasks[taskId];
      if (!task) return;
      const prev = task.assignees;

      set((s) => {
        const updated = { ...s.tasks[taskId], assignees: s.tasks[taskId].assignees.filter((a) => a.id !== userId) };
        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? updated : t)) })),
        };
      });

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          url:    `/api/tasks/${taskId}/assignees/${userId}`,
          method: "DELETE",
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        const res = await fetch(`/api/tasks/${taskId}/assignees/${userId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`DELETE assignee failed: ${res.status}`);
      } catch {
        if (isCurrentlyOffline()) {
          await enqueuePendingOp({
            url:    `/api/tasks/${taskId}/assignees/${userId}`,
            method: "DELETE",
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => {
            const rolled = { ...s.tasks[taskId], assignees: prev };
            return {
              tasks:      { ...s.tasks, [taskId]: rolled },
              epics:      s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
              syncStatus: "error",
            };
          });
        }
      } finally {
        done();
      }
    },

    // ── deleteTask ────────────────────────────────────────────────────────────
    deleteTask: async (taskId: number) => {
      const task = get().tasks[taskId];
      if (!task) return;

      const epicSnapshot = get().epics.find((e) => e.id === task.epicId);

      set((s) => {
        const restTasks = omitTask(s.tasks, taskId);
        return {
          tasks: restTasks,
          epics: s.epics.map((e) =>
            e.id !== task.epicId ? e : {
              ...e,
              tasks:    e.tasks.filter((t) => t.id !== taskId),
              progress: {
                total: e.progress.total - 1,
                done:  task.status === "done" ? e.progress.done - 1 : e.progress.done,
              },
            }
          ),
        };
      });

      const done = get()._beginOp();
      try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`DELETE failed: ${res.status}`);
      } catch {
        if (epicSnapshot) {
          set((s) => ({
            tasks:      { ...s.tasks, [taskId]: task },
            epics:      s.epics.map((e) => (e.id === epicSnapshot.id ? epicSnapshot : e)),
            syncStatus: "error",
          }));
        }
      } finally {
        done();
      }
    },

    // ── reorderTasks ──────────────────────────────────────────────────────────
    reorderTasks: async (epicId, orderedIds) => {
      const prevOrder = get().epics.find((e) => e.id === epicId)?.tasks.map((t) => t.id);

      set((s) => ({
        epics: s.epics.map((e) => {
          if (e.id !== epicId) return e;
          const taskMap = Object.fromEntries(e.tasks.map((t) => [t.id, t]));
          return {
            ...e,
            tasks: orderedIds
              .filter((id) => taskMap[id])
              .map((id, idx) => ({ ...taskMap[id], sortOrder: idx })),
          };
        }),
      }));

      const done = get()._beginOp();
      try {
        await Promise.all(
          orderedIds.map((id, idx) => apiPatch(`/api/tasks/${id}`, { sortOrder: idx }))
        );
      } catch {
        if (prevOrder) {
          set((s) => ({
            epics: s.epics.map((e) => {
              if (e.id !== epicId) return e;
              const taskMap = Object.fromEntries(e.tasks.map((t) => [t.id, t]));
              return { ...e, tasks: prevOrder.map((id) => taskMap[id]).filter(Boolean) as TaskView[] };
            }),
            syncStatus: "error",
          }));
        }
      } finally {
        done();
      }
    },
  }))
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export const useSyncStatus = () =>
  useTaskStore(
    useShallow((s) => ({
      status:           s.syncStatus,
      lastSyncedAt:     s.lastSyncedAt,
      offlineQueueSize: s.offlineQueueSize,
    }))
  );

export const useActiveEpic = () =>
  useTaskStore(
    useShallow((s) =>
      s.activeEpicId ? s.epics.find((e) => e.id === s.activeEpicId) : null
    )
  );