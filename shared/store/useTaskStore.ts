/**
 * @file useTaskStore.ts — shared/store
 *
 * v8 — OFFLINE FIX: сетевые ошибки теперь обрабатываются так же, как офлайн
 *
 * ПРОБЛЕМА v7 (оба бага):
 *
 *   БАГ #1 — "Пишет sync при загрузке":
 *     _beginOp() ставит syncStatus: "syncing", пока fetch висит (до таймаута).
 *     Если WiFi есть, но сервер недоступен — fetch висит долго, сайдбар
 *     показывает "LOCAL: SYNCING" всё это время.
 *
 *   БАГ #2 — "Не получается создать задачи":
 *     createTask / createTaskWithSubtasks проверяли только navigator.onLine.
 *     Если WiFi подключён (navigator.onLine = true), но сервер недоступен,
 *     fetch() бросал TypeError — задача откатывалась и исчезала из UI.
 *
 * РЕШЕНИЕ:
 *   Добавлена функция isNetworkError(err) — определяет сетевые ошибки (TypeError).
 *   В catch-блоках createTask и createTaskWithSubtasks:
 *     если isNetworkError(err) || isCurrentlyOffline() →
 *       ставим задачу в очередь IndexedDB + возвращаем tempTask (не откатываем).
 *   Это работает и при navigator.onLine=false, и при недоступном сервере.
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import {
  enqueuePendingOp,
  updatePendingOp,
  getPendingOps,
  getPendingOpsCount,
  removePendingOp,
  incrementOpRetries,
  MAX_OP_RETRIES,
  type PendingOp,
  type SubtaskDraft,
} from "@/shared/lib/localCache";
import type { EpicWithTasks, TaskView, TaskStatus, TaskPriority, SubtaskView } from "@/shared/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface ReplayResult {
  successCount: number;
  droppedCount: number;
}

export interface CreateWithSubtasksParams {
  epicId:      number;
  title:       string;
  status?:     TaskStatus;
  priority?:   TaskPriority;
  description?: string | null;
  dueDate?:    string | null;
  sortOrder?:  number;
  assigneeIds?: number[];
  /** Массив isCompleted для каждой подзадачи (title генерирует сервер) */
  subtasks?:   SubtaskDraft[];
}

// ── Module-level helpers ──────────────────────────────────────────────────────

let _tempIdSeq = 0;
function nextTempId(): number {
  return -(Date.now() * 1000 + (++_tempIdSeq % 1000));
}

function isCurrentlyOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/**
 * isNetworkError — определяет, является ли ошибка сетевой (сервер недоступен).
 *
 * fetch() бросает TypeError когда:
 *   - Нет сетевого соединения (navigator.onLine = false)
 *   - Сервер недоступен (WiFi есть, но хост не отвечает)
 *   - DNS не резолвится
 *   - Соединение сброшено
 *
 * Это позволяет обрабатывать "сервер недоступен" так же, как "полный офлайн",
 * даже когда navigator.onLine = true (WiFi подключён, но сервер лежит).
 */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

function omitTask(map: Record<number, TaskView>, id: number): Record<number, TaskView> {
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

async function apiPatch(path: string, body: object): Promise<Response> {
  const res = await fetch(path, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  return res;
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

/** Строит temp-подзадачи из черновиков */
function buildTempSubtasks(drafts: SubtaskDraft[]): SubtaskView[] {
  return drafts.map((d, i) => ({
    id:          nextTempId(),
    taskId:      0,
    title:       `Подзадача ${i + 1}`,
    isCompleted: d.isCompleted,
    sortOrder:   d.sortOrder ?? i,
    createdAt:   new Date().toISOString(),
  }));
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

  getEpic:          (id: number) => EpicWithTasks | undefined;
  getTask:          (id: number) => TaskView | undefined;
  getTasksForEpic:  (epicId: number) => TaskView[];
  hydrateEpics:     (epics: EpicWithTasks[]) => void;
  setActiveEpic:    (epicId: number | null) => void;

  // ── Core mutations ──────────────────────────────────────────────────────
  addTask:              (epicId: number, title: string, status?: TaskStatus) => Promise<void>;
  createTask:           (params: { epicId: number; title: string; status?: TaskStatus; priority?: TaskPriority }) => Promise<TaskView | null>;
  createTaskWithSubtasks: (params: CreateWithSubtasksParams) => Promise<TaskView | null>;
  updateTaskStatus:     (taskId: number, status: TaskStatus) => Promise<void>;
  updateTaskPriority:   (taskId: number, priority: TaskPriority) => Promise<void>;
  updateTaskTitle:      (taskId: number, title: string) => Promise<void>;
  updateTaskDescription:(taskId: number, description: string | null) => Promise<void>;
  updateTaskDueDate:    (taskId: number, dueDate: string | null) => Promise<void>;
  addAssignee:          (taskId: number, user: TaskView["assignees"][0]) => Promise<void>;
  removeAssignee:       (taskId: number, userId: number) => Promise<void>;
  toggleSubtask:        (taskId: number, subtaskId: number, current: boolean) => Promise<void>;
  reorderTasks:         (epicId: number, orderedIds: number[]) => Promise<void>;
  deleteTask:           (taskId: number) => Promise<void>;

  // ── Offline queue ────────────────────────────────────────────────────────
  refreshOfflineQueue:  () => Promise<void>;
  replayOfflineQueue:   () => Promise<ReplayResult>;

  _beginOp:             () => () => void;
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

    getEpic:         (id) => get().epics.find((e) => e.id === id),
    getTask:         (id) => get().tasks[id],
    getTasksForEpic: (epicId) => get().epics.find((e) => e.id === epicId)?.tasks ?? [],

    hydrateEpics: (epics) => set({
      epics,
      tasks:        buildTaskIndex(epics),
      syncStatus:   "synced",
      lastSyncedAt: new Date(),
    }),

    setActiveEpic: (epicId) => set({ activeEpicId: epicId }),

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

      const tempToReal = new Map<number, number>();

      for (const op of ops) {
        if (isCurrentlyOffline()) break;

        try {
          // ── create_with_relations ──────────────────────────────────────────
          if (op.kind === "create_with_relations") {
            const res = await fetch("/api/tasks", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({
                epicId:      op.epicId,
                title:       op.title,
                status:      op.status,
                priority:    op.priority,
                description: op.description,
                dueDate:     op.dueDate,
                sortOrder:   op.sortOrder,
                assigneeIds: op.assigneeIds,
                subtasks:    op.subtasks,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const realId: number = data.data.id;
              const subtaskIds: number[] = data.data.subtaskIds ?? [];

              tempToReal.set(op.tempTaskId, realId);

              set((s) => {
                const tempTask = s.tasks[op.tempTaskId];
                if (!tempTask) return s;

                const realSubtasks: SubtaskView[] = tempTask.subtasks.map((st, i) => ({
                  ...st,
                  id:     subtaskIds[i] ?? st.id,
                  taskId: realId,
                }));

                const realTask: TaskView = {
                  ...tempTask,
                  id:       realId,
                  subtasks: realSubtasks,
                  progress: {
                    done:  realSubtasks.filter((st) => st.isCompleted).length,
                    total: realSubtasks.length,
                  },
                };

                const restTasks = omitTask(s.tasks, op.tempTaskId);
                return {
                  tasks: { ...restTasks, [realId]: realTask },
                  epics: s.epics.map((e) =>
                    e.id !== op.epicId ? e : {
                      ...e,
                      tasks: e.tasks.map((t) => t.id === op.tempTaskId ? realTask : t),
                      progress: {
                        total: e.progress.total,
                        done:  e.progress.done,
                      },
                    }
                  ),
                };
              });

              await removePendingOp(op.id);
              successCount++;
              set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));

            } else if (res.status >= 400 && res.status < 500) {
              await removePendingOp(op.id);
              droppedCount++;
              set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
            } else {
              if (op.retries >= MAX_OP_RETRIES) {
                await removePendingOp(op.id);
                droppedCount++;
                set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
              } else {
                await incrementOpRetries(op.id);
              }
            }
            continue;
          }

          // ── patch_task с rebase на 409 ────────────────────────────────────
          if (op.kind === "patch_task") {
            let url = op.url;
            const patch = { ...op.patch };
            let expectedUpdatedAt = op.expectedUpdatedAt;

            const tempMatch = url.match(/\/api\/tasks\/(-\d+)/);
            if (tempMatch) {
              const tempId = Number(tempMatch[1]);
              const realId = tempToReal.get(tempId);
              if (realId) {
                url = url.replace(`/api/tasks/${tempId}`, `/api/tasks/${realId}`);
              } else {
                continue;
              }
            }

            const res = await apiPatch(url, { ...patch, expectedUpdatedAt });

            if (res.ok) {
              await removePendingOp(op.id);
              successCount++;
              set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
            } else if (res.status === 409) {
              const taskIdMatch = url.match(/\/api\/tasks\/(\d+)/);
              if (!taskIdMatch) { await removePendingOp(op.id); droppedCount++; continue; }
              const taskId = Number(taskIdMatch[1]);

              const currentRes = await fetch(`/api/tasks/${taskId}`);
              if (!currentRes.ok) { await removePendingOp(op.id); droppedCount++; continue; }

              const currentData = await currentRes.json();
              const currentTask: TaskView = currentData.data;

              expectedUpdatedAt = currentTask.updatedAt;

              const rebaseRes = await apiPatch(url, { ...patch, expectedUpdatedAt });

              if (rebaseRes.ok) {
                const mergedTask = { ...currentTask, ...patch };
                set((s) => ({
                  tasks: { ...s.tasks, [taskId]: mergedTask as TaskView },
                  epics: updateEpicsForTask(s.epics, taskId, (tasks) =>
                    tasks.map((t) => t.id === taskId ? mergedTask as TaskView : t)
                  ),
                }));

                await removePendingOp(op.id);
                successCount++;
                set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
              } else {
                await removePendingOp(op.id);
                droppedCount++;
                set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
              }
            } else if (res.status >= 400 && res.status < 500) {
              await removePendingOp(op.id);
              droppedCount++;
              set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
            } else {
              if (op.retries >= MAX_OP_RETRIES) {
                await removePendingOp(op.id);
                droppedCount++;
                set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
              } else {
                await incrementOpRetries(op.id);
              }
            }
            continue;
          }

          // ── legacy op (subtask toggle, assignee) ──────────────────────────
          if (!op.kind) {
            let url = op.url;
            const tempMatch = url.match(/\/api\/tasks\/(-\d+)/);
            if (tempMatch) {
              const tempId = Number(tempMatch[1]);
              const realId = tempToReal.get(tempId);
              if (realId) url = url.replace(`/api/tasks/${tempId}`, `/api/tasks/${realId}`);
              else continue;
            }

            const res = await fetch(url, {
              method: op.method,
              headers: op.body ? { "Content-Type": "application/json" } : {},
              body:    op.body ? JSON.stringify(op.body) : undefined,
            });

            if (res.ok) {
              await removePendingOp(op.id);
              successCount++;
              set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
            } else if (res.status >= 400 && res.status < 500) {
              await removePendingOp(op.id);
              droppedCount++;
              set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
            } else {
              if (op.retries >= MAX_OP_RETRIES) {
                await removePendingOp(op.id);
                droppedCount++;
                set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
              } else {
                await incrementOpRetries(op.id);
              }
            }
          }
        } catch {
          break;
        }
      }

      const remaining = await getPendingOpsCount();
      set({
        offlineQueueSize: remaining,
        syncStatus:       remaining === 0 ? "synced" : "error",
        lastSyncedAt:     remaining === 0 ? new Date() : get().lastSyncedAt,
      });

      return { successCount, droppedCount };
    },

    // ── createTaskWithSubtasks ────────────────────────────────────────────────
    createTaskWithSubtasks: async (params) => {
      const {
        epicId, title, status = "todo", priority = "medium",
        description = null, dueDate = null, sortOrder = 9999,
        assigneeIds = [], subtasks: subtaskDrafts = [],
      } = params;

      const tempId  = nextTempId();
      const now     = new Date().toISOString();
      const tempSubs = buildTempSubtasks(subtaskDrafts);

      const tempTask: TaskView = {
        id: tempId, epicId, title, description, status, priority,
        dueDate, sortOrder, createdAt: now, updatedAt: now,
        assignees: [],
        subtasks:  tempSubs,
        progress: {
          done:  tempSubs.filter((s) => s.isCompleted).length,
          total: tempSubs.length,
        },
      };

      set((s) => ({
        tasks: { ...s.tasks, [tempId]: tempTask },
        epics: s.epics.map((e) =>
          e.id !== epicId ? e : {
            ...e,
            tasks:    [...e.tasks, tempTask],
            progress: { total: e.progress.total + 1, done: e.progress.done },
          }
        ),
      }));

      // Проверяем офлайн ДО fetch
      if (isCurrentlyOffline()) {
        const queuedCreate: Omit<PendingOp & { kind: "create_with_relations" }, "id" | "createdAt" | "retries"> = {
          kind:        "create_with_relations",
          tempTaskId:  tempId,
          epicId, title, status, priority, description, dueDate,
          sortOrder:   sortOrder ?? 9999,
          assigneeIds,
          subtasks:    subtaskDrafts,
        };
        await enqueuePendingOp(queuedCreate as Parameters<typeof enqueuePendingOp>[0]);
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return tempTask;
      }

      const done = get()._beginOp();
      try {
        const res  = await fetch("/api/tasks", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            epicId, title, status, priority, description, dueDate,
            sortOrder: sortOrder ?? 9999,
            assigneeIds,
            subtasks: subtaskDrafts,
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const realId:    number   = data.data.id;
        const subtaskIds: number[] = data.data.subtaskIds ?? [];

        const realSubs: SubtaskView[] = tempSubs.map((st, i) => ({
          ...st,
          id:     subtaskIds[i] ?? st.id,
          taskId: realId,
        }));

        const realTask: TaskView = {
          ...tempTask,
          id:       realId,
          subtasks: realSubs,
          progress: {
            done:  realSubs.filter((s) => s.isCompleted).length,
            total: realSubs.length,
          },
        };

        set((s) => {
          const restTasks = omitTask(s.tasks, tempId);
          return {
            tasks: { ...restTasks, [realId]: realTask },
            epics: s.epics.map((e) =>
              e.id !== epicId ? e : {
                ...e,
                tasks: e.tasks.map((t) => t.id === tempId ? realTask : t),
              }
            ),
          };
        });

        return realTask;
      } catch (err) {
        // ИСПРАВЛЕНО v8: сетевая ошибка (сервер недоступен) = ставим в очередь.
        // Раньше: задача откатывалась и исчезала из UI.
        // Теперь: задача остаётся в store + ставится в IndexedDB очередь.
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind:        "create_with_relations",
            tempTaskId:  tempId,
            epicId, title, status, priority, description, dueDate,
            sortOrder:   sortOrder ?? 9999,
            assigneeIds,
            subtasks:    subtaskDrafts,
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
          return tempTask; // Не откатываем — задача остаётся в UI
        }
        // Не сетевая ошибка (например, ошибка валидации от сервера) — откатываем
        set((s) => {
          const restTasks = omitTask(s.tasks, tempId);
          return {
            tasks:      restTasks,
            epics:      s.epics.map((e) =>
              e.id !== epicId ? e : {
                ...e,
                tasks:    e.tasks.filter((t) => t.id !== tempId),
                progress: { total: e.progress.total - 1, done: e.progress.done },
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

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          kind: "create_with_relations",
          tempTaskId: tempId,
          epicId, title, status,
          priority: "medium",
          description: null,
          dueDate: null,
          sortOrder: 9999,
          assigneeIds: [],
          subtasks: [],
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        const res  = await fetch("/api/tasks", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ epicId, title, status, priority: "medium", sortOrder: 9999 }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const realId = data.data.id;
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
      } catch (err) {
        // Сетевая ошибка → очередь
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: "create_with_relations",
            tempTaskId: tempId,
            epicId, title, status,
            priority: "medium",
            description: null,
            dueDate: null,
            sortOrder: 9999,
            assigneeIds: [],
            subtasks: [],
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
          return;
        }
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

      // Проверяем офлайн ДО fetch
      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          kind: "create_with_relations",
          tempTaskId: tempId,
          epicId, title, status, priority,
          description: null,
          dueDate: null,
          sortOrder: 9999,
          assigneeIds: [],
          subtasks: [],
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return tempTask;
      }

      const done = get()._beginOp();
      try {
        const res  = await fetch("/api/tasks", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ epicId, title, status, priority, sortOrder: 9999 }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const realId = data.data.id;
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
      } catch (err) {
        // ИСПРАВЛЕНО v8: сетевая ошибка → ставим в очередь, не откатываем.
        // До этого: задача исчезала из UI при недоступном сервере.
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: "create_with_relations",
            tempTaskId: tempId,
            epicId, title, status, priority,
            description: null,
            dueDate: null,
            sortOrder: 9999,
            assigneeIds: [],
            subtasks: [],
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
          return tempTask; // Задача остаётся в UI
        }
        // Ошибка валидации — откатываем
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

      // Если temp-задача — мержим изменение в queued create
      if (taskId < 0) {
        const ops = await getPendingOps();
        const createOp = ops.find(
          (op): op is Extract<PendingOp, { kind: "create_with_relations" }> =>
            op.kind === "create_with_relations" && op.tempTaskId === taskId
        );
        if (createOp) {
          const mergedSubtasks: SubtaskDraft[] = updatedSubtasks.map((st) => ({
            isCompleted: st.isCompleted,
            sortOrder:   st.sortOrder,
          }));
          await updatePendingOp({ ...createOp, status, subtasks: mergedSubtasks });
        }
        return;
      }

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          kind:               "patch_task",
          url:                `/api/tasks/${taskId}`,
          patch:              { status },
          expectedUpdatedAt:  task.updatedAt,
        });
        for (const subtaskId of subtasksToUpdate) {
          await enqueuePendingOp({
            kind:    undefined,
            url:     `/api/subtasks/${subtaskId}`,
            method:  "PATCH",
            body:    { isCompleted: true },
          });
        }
        set((s) => ({
          offlineQueueSize: s.offlineQueueSize + 1 + subtasksToUpdate.length,
        }));
        return;
      }

      const done = get()._beginOp();
      try {
        const res = await apiPatch(`/api/tasks/${taskId}`, { status });
        if (!res.ok && res.status !== 409) throw new Error(`status ${res.status}`);
        if (subtasksToUpdate.length > 0) {
          await Promise.all(
            subtasksToUpdate.map((id) => apiPatch(`/api/subtasks/${id}`, { isCompleted: true }))
          );
        }
      } catch {
        if (isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind:               "patch_task",
            url:                `/api/tasks/${taskId}`,
            patch:              { status },
            expectedUpdatedAt:  task.updatedAt,
          });
          for (const subtaskId of subtasksToUpdate) {
            await enqueuePendingOp({
              kind:   undefined,
              url:    `/api/subtasks/${subtaskId}`,
              method: "PATCH",
              body:   { isCompleted: true },
            });
          }
          set((s) => ({
            offlineQueueSize: s.offlineQueueSize + 1 + subtasksToUpdate.length,
          }));
        } else {
          set((s) => {
            const rolled: TaskView = {
              ...s.tasks[taskId], status: prevStatus, subtasks: prevSubtasks,
              progress: { total: prevSubtasks.length, done: prevSubtasks.filter((st) => st.isCompleted).length },
            };
            return {
              tasks:      { ...s.tasks, [taskId]: rolled },
              epics:      updateEpicsForTask(s.epics, taskId, (ts) => ts.map((t) => (t.id === taskId ? rolled : t))),
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
        const subs   = task.subtasks.map((st) => st.id === subtaskId ? { ...st, isCompleted: newVal } : st);
        const doneCt = subs.filter((st) => st.isCompleted).length;
        const updated: TaskView = { ...task, subtasks: subs, progress: { done: doneCt, total: subs.length } };
        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: updateEpicsForTask(s.epics, taskId, (tasks) => tasks.map((t) => (t.id === taskId ? updated : t))),
        };
      });

      if (taskId < 0) {
        const ops = await getPendingOps();
        const createOp = ops.find(
          (op): op is Extract<PendingOp, { kind: "create_with_relations" }> =>
            op.kind === "create_with_relations" && op.tempTaskId === taskId
        );
        if (createOp) {
          const task = get().tasks[taskId];
          const subtaskIndex = task?.subtasks.findIndex((s) => s.id === subtaskId) ?? -1;
          if (subtaskIndex >= 0 && createOp.subtasks[subtaskIndex] !== undefined) {
            const updatedSubs = createOp.subtasks.map((s, i) =>
              i === subtaskIndex ? { ...s, isCompleted: newVal } : s
            );
            await updatePendingOp({ ...createOp, subtasks: updatedSubs });
          }
        }
        return;
      }

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          kind: undefined,
          url: `/api/subtasks/${subtaskId}`,
          method: "PATCH",
          body: { isCompleted: newVal },
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        const res = await apiPatch(`/api/subtasks/${subtaskId}`, { isCompleted: newVal });
        if (!res.ok) throw new Error(`status ${res.status}`);
      } catch {
        if (isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: undefined,
            url: `/api/subtasks/${subtaskId}`,
            method: "PATCH",
            body: { isCompleted: newVal },
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => {
            const task = s.tasks[taskId];
            if (!task) return s;
            const rolled = task.subtasks.map((st) => st.id === subtaskId ? { ...st, isCompleted: current } : st);
            const rolledTask: TaskView = { ...task, subtasks: rolled, progress: { done: rolled.filter((st) => st.isCompleted).length, total: rolled.length } };
            return {
              tasks:      { ...s.tasks, [taskId]: rolledTask },
              epics:      updateEpicsForTask(s.epics, taskId, (ts) => ts.map((t) => (t.id === taskId ? rolledTask : t))),
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
          epics: updateEpicsForTask(s.epics, taskId, (ts) => ts.map((t) => (t.id === taskId ? updated : t))),
        };
      });

      if (taskId < 0) {
        const ops = await getPendingOps();
        const createOp = ops.find((op): op is Extract<PendingOp, { kind: "create_with_relations" }> =>
          op.kind === "create_with_relations" && op.tempTaskId === taskId);
        if (createOp) await updatePendingOp({ ...createOp, priority });
        return;
      }

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          kind: "patch_task" as const,
          url: `/api/tasks/${taskId}`,
          patch: { priority },
          expectedUpdatedAt: get().tasks[taskId]?.updatedAt,
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/tasks/${taskId}`, { priority });
      } catch {
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], priority: prev } },
          syncStatus: "error",
        }));
      } finally { done(); }
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

      if (taskId < 0) {
        const ops = await getPendingOps();
        const createOp = ops.find((op): op is Extract<PendingOp, { kind: "create_with_relations" }> =>
          op.kind === "create_with_relations" && op.tempTaskId === taskId);
        if (createOp) await updatePendingOp({ ...createOp, title: patched });
        return;
      }

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          kind: "patch_task" as const,
          url: `/api/tasks/${taskId}`,
          patch: { title: patched },
          expectedUpdatedAt: get().tasks[taskId]?.updatedAt,
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/tasks/${taskId}`, { title: patched });
      } catch {
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], title: prev } },
          syncStatus: "error",
        }));
      } finally { done(); }
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
        await enqueuePendingOp({
          kind: "patch_task" as const,
          url: `/api/tasks/${taskId}`,
          patch: { description: next },
          expectedUpdatedAt: get().tasks[taskId]?.updatedAt,
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/tasks/${taskId}`, { description: next });
      } catch {
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], description: prev } },
          syncStatus: "error",
        }));
      } finally { done(); }
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
        await enqueuePendingOp({
          kind: "patch_task" as const,
          url: `/api/tasks/${taskId}`,
          patch: { dueDate: dueDate ?? null },
          expectedUpdatedAt: get().tasks[taskId]?.updatedAt,
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/tasks/${taskId}`, { dueDate });
      } catch {
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], dueDate: prev } },
          syncStatus: "error",
        }));
      } finally { done(); }
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

      if (taskId < 0) {
        const ops = await getPendingOps();
        const createOp = ops.find((op): op is Extract<PendingOp, { kind: "create_with_relations" }> =>
          op.kind === "create_with_relations" && op.tempTaskId === taskId);
        if (createOp && !createOp.assigneeIds.includes(user.id)) {
          await updatePendingOp({ ...createOp, assigneeIds: [...createOp.assigneeIds, user.id] });
        }
        return;
      }

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          kind: undefined,
          url: `/api/tasks/${taskId}/assignees`,
          method: "POST",
          body: { userId: user.id },
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
        if (!res.ok) throw new Error(`status ${res.status}`);
      } catch {
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], assignees: s.tasks[taskId].assignees.filter((a) => a.id !== user.id) } },
          syncStatus: "error",
        }));
      } finally { done(); }
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
          kind: undefined,
          url: `/api/tasks/${taskId}/assignees/${userId}`,
          method: "DELETE",
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const done = get()._beginOp();
      try {
        const res = await fetch(`/api/tasks/${taskId}/assignees/${userId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`status ${res.status}`);
      } catch {
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], assignees: prev } },
          syncStatus: "error",
        }));
      } finally { done(); }
    },

    // ── deleteTask ────────────────────────────────────────────────────────────
    deleteTask: async (taskId) => {
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
        if (!res.ok) throw new Error(`status ${res.status}`);
      } catch {
        if (epicSnapshot) {
          set((s) => ({
            tasks:      { ...s.tasks, [taskId]: task },
            epics:      s.epics.map((e) => (e.id === epicSnapshot.id ? epicSnapshot : e)),
            syncStatus: "error",
          }));
        }
      } finally { done(); }
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
      } finally { done(); }
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