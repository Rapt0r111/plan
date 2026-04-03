/**
 * @file useTaskStore.ts — shared/store
 *
 * v11 — Fix: Race-condition duplication in offline sync
 *
 * BUG (v10): When replayOfflineQueue POSTs a task/epic to the server,
 * the API route calls broadcast() (SSE). The client's own SSE handler
 * receives this immediately and calls router.refresh() → hydrateEpics,
 * concurrently with the replay's set() that replaces temp IDs with real ones.
 *
 * Race sequence that caused duplicates:
 *   1. Replay POSTs → server creates id=5 AND broadcasts SSE
 *   2. Client SSE handler: router.refresh() → hydrateEpics runs
 *      (store still has temp id=-1234 because replay set() hasn't run yet)
 *   3. hydrateEpics injects temp into server epic:
 *      epic.tasks = [realTask{id:5}, tempTask{id:-1234}]
 *   4. Replay set() maps tempTask{id:-1234} → realTask{id:5}:
 *      epic.tasks = [realTask{id:5}, realTask{id:5}] ← DUPLICATE
 *
 * FIX: Three deduplication points:
 *   FIX 1 – hydrateEpics: dedup epics+tasks after merge (primary guard)
 *   FIX 2 – replayOfflineQueue create_with_relations set(): dedup tasks after map
 *   FIX 3 – replayOfflineQueue create_epic set(): dedup epics after map
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import {
  enqueuePendingOp,
  updatePendingOp,
  getPendingOps,
  getPendingOpsCount,
  cacheEpics,
  removePendingOp,
  incrementOpRetries,
  MAX_OP_RETRIES,
  type PendingOp,
  type SubtaskDraft,
} from "@/shared/lib/localCache";
import type { EpicWithTasks, TaskView, TaskStatus, TaskPriority, SubtaskView, DbEpic } from "@/shared/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface ReplayResult {
  successCount: number;
  droppedCount: number;
}

export interface CreateWithSubtasksParams {
  epicId: number;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  description?: string | null;
  dueDate?: string | null;
  sortOrder?: number;
  assigneeIds?: number[];
  subtasks?: SubtaskDraft[];
}

export interface CreateEpicParams {
  title: string;
  description?: string | null;
  color?: string;
  startDate?: string | null;
  endDate?: string | null;
}

// ── Module-level helpers ──────────────────────────────────────────────────────

let _tempIdSeq = 0;
function nextTempId(): number {
  return -(Date.now() * 1000 + (++_tempIdSeq % 1000));
}

function isCurrentlyOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

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
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
        done: newTasks.filter((t) => t.status === "done").length,
      },
    };
  });
}

function buildTempSubtasks(drafts: SubtaskDraft[]): SubtaskView[] {
  return drafts.map((d, i) => ({
    id: nextTempId(),
    taskId: 0,
    title: `Подзадача ${i + 1}`,
    isCompleted: d.isCompleted,
    sortOrder: d.sortOrder ?? i,
    createdAt: new Date().toISOString(),
  }));
}

// ── Store interface ───────────────────────────────────────────────────────────

interface TaskStore {
  epics: EpicWithTasks[];
  tasks: Record<number, TaskView>;
  activeEpicId: number | null;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  pendingOps: number;
  offlineQueueSize: number;

  getEpic: (id: number) => EpicWithTasks | undefined;
  getTask: (id: number) => TaskView | undefined;
  getTasksForEpic: (epicId: number) => TaskView[];

  hydrateEpics: (epics: EpicWithTasks[]) => void;
  setActiveEpic: (epicId: number | null) => void;

  createEpic: (params: CreateEpicParams) => Promise<EpicWithTasks | null>;

  addTask: (epicId: number, title: string, status?: TaskStatus) => Promise<void>;
  createTask: (params: { epicId: number; title: string; status?: TaskStatus; priority?: TaskPriority }) => Promise<TaskView | null>;
  createTaskWithSubtasks: (params: CreateWithSubtasksParams) => Promise<TaskView | null>;
  updateTaskStatus: (taskId: number, status: TaskStatus) => Promise<void>;
  updateTaskPriority: (taskId: number, priority: TaskPriority) => Promise<void>;
  updateTaskTitle: (taskId: number, title: string) => Promise<void>;
  updateTaskDescription: (taskId: number, description: string | null) => Promise<void>;
  updateTaskDueDate: (taskId: number, dueDate: string | null) => Promise<void>;
  addAssignee: (taskId: number, user: TaskView["assignees"][0]) => Promise<void>;
  removeAssignee: (taskId: number, userId: number) => Promise<void>;
  toggleSubtask: (taskId: number, subtaskId: number, current: boolean) => Promise<void>;
  reorderTasks: (epicId: number, orderedIds: number[]) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;

  refreshOfflineQueue: () => Promise<void>;
  replayOfflineQueue: () => Promise<ReplayResult>;

  _beginOp: () => () => void;
}

// ── Store implementation ──────────────────────────────────────────────────────

export const useTaskStore = create<TaskStore>()(
  subscribeWithSelector((set, get) => ({
    epics: [],
    tasks: {},
    activeEpicId: null,
    syncStatus: "idle",
    lastSyncedAt: null,
    pendingOps: 0,
    offlineQueueSize: 0,

    getEpic: (id) => get().epics.find((e) => e.id === id),
    getTask: (id) => get().tasks[id],
    getTasksForEpic: (epicId) => get().epics.find((e) => e.id === epicId)?.tasks ?? [],

    // ─────────────────────────────────────────────────────────────────────────
    // hydrateEpics v11 — MERGE + DEDUP
    //
    // FIX 1: After merging server epics with temp items, deduplicate both the
    // epics list and each epic's tasks list. This is the primary guard against
    // the race condition where SSE-triggered hydrateEpics runs concurrently
    // with replayOfflineQueue's set() calls.
    // ─────────────────────────────────────────────────────────────────────────
    hydrateEpics: (serverEpics) => set((s) => {
      // ── Step 1: preserve temp epics (id < 0) ─────────────────────────────
      const tempEpics = s.epics.filter((e) => e.id < 0);

      // ── Step 2: collect temp tasks grouped by their real epicId ───────────
      const allTempTasks: Record<number, TaskView> = {};
      const pendingByEpic: Record<number, TaskView[]> = {};

      for (const [idStr, task] of Object.entries(s.tasks)) {
        const id = Number(idStr);
        if (id < 0) {
          allTempTasks[id] = task;
          if (task.epicId > 0) {
            (pendingByEpic[task.epicId] ??= []).push(task);
          }
        }
      }

      // ── Step 3: inject pending temp tasks into their real epics ──────────
      const serverEpicsWithPending = serverEpics.map((epic) => {
        const pending = pendingByEpic[epic.id];
        if (!pending?.length) return epic;
        const allTasks = [...epic.tasks, ...pending];
        return {
          ...epic,
          tasks: allTasks,
          progress: {
            total: allTasks.length,
            done: allTasks.filter((t) => t.status === "done").length,
          },
        };
      });

      const mergedEpics = [...serverEpicsWithPending, ...tempEpics];
      const serverTasks = buildTaskIndex(serverEpics);

      // ── FIX 1: Deduplicate (race condition guard) ─────────────────────────
      // When replayOfflineQueue creates an item on the server, the API route
      // calls broadcast() which triggers SSE on all clients including ourselves.
      // Our SSE handler calls router.refresh() → hydrateEpics concurrently with
      // the replay's set() that replaces temp IDs. This creates duplicates:
      //   epic.tasks = [realTask{id:5}, tempTask{id:-1}]  (after injection)
      //   then replay maps tempTask → realTask: [task{5}, task{5}] ← BUG
      // Deduplicating here (and in the replay set() calls) eliminates both sides.
      const seenEpicIds = new Set<number>();
      const dedupedEpics = mergedEpics
        .filter(e => {
          if (seenEpicIds.has(e.id)) return false;
          seenEpicIds.add(e.id);
          return true;
        })
        .map(epic => {
          const seenTaskIds = new Set<number>();
          return {
            ...epic,
            tasks: epic.tasks.filter(t => {
              if (seenTaskIds.has(t.id)) return false;
              seenTaskIds.add(t.id);
              return true;
            }),
          };
        });

      return {
        epics: dedupedEpics,
        tasks: { ...serverTasks, ...allTempTasks },
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      };
    }),

    setActiveEpic: (epicId) => set({ activeEpicId: epicId }),

    _beginOp: () => {
      set((s) => ({ pendingOps: s.pendingOps + 1, syncStatus: "syncing" }));
      return () => set((s) => {
        const next = s.pendingOps - 1;
        return {
          pendingOps: next,
          syncStatus: next === 0 ? "synced" : "syncing",
          lastSyncedAt: next === 0 ? new Date() : s.lastSyncedAt,
        };
      });
    },

    // ── refreshOfflineQueue ───────────────────────────────────────────────────
    refreshOfflineQueue: async () => {
      const count = await getPendingOpsCount();
      set({ offlineQueueSize: count });
    },

    // ── createEpic ────────────────────────────────────────────────────────────
    createEpic: async (params) => {
      const {
        title,
        description = null,
        color = "#8b5cf6",
        startDate = null,
        endDate = null,
      } = params;

      const tempId = nextTempId();
      const now = new Date().toISOString();

      const tempEpic: EpicWithTasks = {
        id: tempId,
        title,
        description,
        color,
        startDate,
        endDate,
        createdAt: now,
        updatedAt: now,
        tasks: [],
        progress: { done: 0, total: 0 },
      };

      set((s) => ({ epics: [...s.epics, tempEpic] }));
      cacheEpics(get().epics);

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          kind: "create_epic",
          tempEpicId: tempId,
          title, description, color, startDate, endDate,
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return tempEpic;
      }

      const done = get()._beginOp();
      try {
        const res = await fetch("/api/epics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, color, startDate, endDate }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error ?? "Epic creation failed");

        const realEpic: DbEpic = data.data;
        const realId = realEpic.id;

        set((s) => ({
          epics: s.epics.map((e) =>
            e.id === tempId
              ? { ...tempEpic, id: realId, createdAt: realEpic.createdAt, updatedAt: realEpic.updatedAt }
              : e
          ),
        }));

        cacheEpics(get().epics);
        return { ...tempEpic, id: realId };
      } catch (err) {
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: "create_epic",
            tempEpicId: tempId,
            title, description, color, startDate, endDate,
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
          return tempEpic;
        }
        set((s) => ({
          epics: s.epics.filter((e) => e.id !== tempId),
          syncStatus: "error",
        }));
        cacheEpics(get().epics);
        return null;
      } finally {
        done();
      }
    },

    // ── replayOfflineQueue ────────────────────────────────────────────────────
    replayOfflineQueue: async () => {
      const ops = await getPendingOps();
      if (ops.length === 0) return { successCount: 0, droppedCount: 0 };

      let successCount = 0;
      let droppedCount = 0;

      const tempEpicToReal = new Map<number, number>();
      const tempToReal = new Map<number, number>();

      // ── Pass 1: create_epic ───────────────────────────────────────────────
      const epicOps = ops.filter(
        (op): op is Extract<PendingOp, { kind: "create_epic" }> => op.kind === "create_epic"
      );

      for (const op of epicOps) {
        if (isCurrentlyOffline()) break;

        try {
          const res = await fetch("/api/epics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: op.title,
              description: op.description,
              color: op.color,
              startDate: op.startDate,
              endDate: op.endDate,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const realId = data.data.id as number;
            const realEpic = data.data as DbEpic;

            tempEpicToReal.set(op.tempEpicId, realId);

            set((s) => {
              // FIX 3: Deduplicate epics after replacing temp with real.
              // If hydrateEpics ran concurrently (triggered by the SSE broadcast
              // from this very POST), s.epics may contain both the temp epic
              // (id=op.tempEpicId) and the real epic (id=realId). After mapping
              // temp → real, both entries have id=realId. Filter keeps first.
              const seenReplayEpicIds = new Set<number>();
              const updatedEpics = s.epics
                .map((e) =>
                  e.id === op.tempEpicId
                    ? {
                      ...e,
                      id: realId,
                      createdAt: realEpic.createdAt,
                      updatedAt: realEpic.updatedAt,
                      tasks: e.tasks.map((t) => ({ ...t, epicId: realId })),
                    }
                    : e
                )
                .filter(e => {
                  if (seenReplayEpicIds.has(e.id)) return false;
                  seenReplayEpicIds.add(e.id);
                  return true;
                });

              const updatedTasks: Record<number, TaskView> = {};
              for (const [idStr, task] of Object.entries(s.tasks)) {
                const id = Number(idStr);
                updatedTasks[id] = task.epicId === op.tempEpicId
                  ? { ...task, epicId: realId }
                  : task;
              }

              return { epics: updatedEpics, tasks: updatedTasks };
            });

            cacheEpics(get().epics);
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
        } catch {
          break;
        }
      }

      // ── Pass 2: everything else ───────────────────────────────────────────
      const otherOps = ops.filter((op) => op.kind !== "create_epic");

      for (const op of otherOps) {
        if (isCurrentlyOffline()) break;

        try {
          if (op.kind === "create_with_relations") {
            let epicId = op.epicId;
            if (epicId < 0 && tempEpicToReal.has(epicId)) {
              epicId = tempEpicToReal.get(epicId)!;
            } else if (epicId < 0) {
              await removePendingOp(op.id);
              droppedCount++;
              set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));
              continue;
            }

            const res = await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                epicId,
                title: op.title,
                status: op.status,
                priority: op.priority,
                description: op.description,
                dueDate: op.dueDate,
                sortOrder: op.sortOrder,
                assigneeIds: op.assigneeIds,
                subtasks: op.subtasks,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const realId = data.data.id as number;
              const subtaskIds = data.data.subtaskIds as number[] ?? [];

              tempToReal.set(op.tempTaskId, realId);

              set((s) => {
                const tempTask = s.tasks[op.tempTaskId];
                if (!tempTask) return s;

                const realSubtasks: SubtaskView[] = tempTask.subtasks.map((st, i) => ({
                  ...st,
                  id: subtaskIds[i] ?? st.id,
                  taskId: realId,
                }));

                const realTask: TaskView = {
                  ...tempTask,
                  id: realId,
                  epicId,
                  subtasks: realSubtasks,
                  progress: {
                    done: realSubtasks.filter((st) => st.isCompleted).length,
                    total: realSubtasks.length,
                  },
                };

                const restTasks = omitTask(s.tasks, op.tempTaskId);
                return {
                  tasks: { ...restTasks, [realId]: realTask },
                  epics: s.epics.map((e) => {
                    if (e.id !== epicId) return e;
                    // FIX 2: Deduplicate tasks after replacing temp with real.
                    // If hydrateEpics ran concurrently (from SSE), e.tasks may
                    // already contain realTask{id:realId} AND tempTask{id:op.tempTaskId}.
                    // After map, both entries get id=realId. Filter removes the dupe.
                    const seenTaskIds = new Set<number>();
                    return {
                      ...e,
                      tasks: e.tasks
                        .map((t) => t.id === op.tempTaskId ? realTask : t)
                        .filter(t => {
                          if (seenTaskIds.has(t.id)) return false;
                          seenTaskIds.add(t.id);
                          return true;
                        }),
                      progress: { total: e.progress.total, done: e.progress.done },
                    };
                  }),
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

          // Legacy ops (subtask toggle, assignee add/remove)
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
              body: op.body ? JSON.stringify(op.body) : undefined,
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
        syncStatus: remaining === 0 ? "synced" : "error",
        lastSyncedAt: remaining === 0 ? new Date() : get().lastSyncedAt,
      });

      cacheEpics(get().epics);

      return { successCount, droppedCount };
    },

    // ── createTaskWithSubtasks ────────────────────────────────────────────────
    createTaskWithSubtasks: async (params) => {
      const {
        epicId, title, status = "todo", priority = "medium",
        description = null, dueDate = null, sortOrder = 9999,
        assigneeIds = [], subtasks: subtaskDrafts = [],
      } = params;

      const tempId = nextTempId();
      const now = new Date().toISOString();
      const tempSubs = buildTempSubtasks(subtaskDrafts);

      const tempTask: TaskView = {
        id: tempId, epicId, title, description, status, priority,
        dueDate, sortOrder, createdAt: now, updatedAt: now,
        assignees: [],
        subtasks: tempSubs,
        progress: {
          done: tempSubs.filter((s) => s.isCompleted).length,
          total: tempSubs.length,
        },
      };

      set((s) => ({
        tasks: { ...s.tasks, [tempId]: tempTask },
        epics: s.epics.map((e) =>
          e.id !== epicId ? e : {
            ...e,
            tasks: [...e.tasks, tempTask],
            progress: { total: e.progress.total + 1, done: e.progress.done },
          }
        ),
      }));

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          kind: "create_with_relations",
          tempTaskId: tempId,
          epicId, title, status, priority, description, dueDate,
          sortOrder: sortOrder ?? 9999,
          assigneeIds,
          subtasks: subtaskDrafts,
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return tempTask;
      }

      const done = get()._beginOp();
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            epicId, title, status, priority, description, dueDate,
            sortOrder: sortOrder ?? 9999,
            assigneeIds,
            subtasks: subtaskDrafts,
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const realId = data.data.id as number;
        const subtaskIds = data.data.subtaskIds as number[] ?? [];

        const realSubs: SubtaskView[] = tempSubs.map((st, i) => ({
          ...st,
          id: subtaskIds[i] ?? st.id,
          taskId: realId,
        }));

        const realTask: TaskView = {
          ...tempTask,
          id: realId,
          subtasks: realSubs,
          progress: {
            done: realSubs.filter((s) => s.isCompleted).length,
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
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: "create_with_relations",
            tempTaskId: tempId,
            epicId, title, status, priority, description, dueDate,
            sortOrder: sortOrder ?? 9999,
            assigneeIds,
            subtasks: subtaskDrafts,
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
          return tempTask;
        }
        set((s) => {
          const restTasks = omitTask(s.tasks, tempId);
          return {
            tasks: restTasks,
            epics: s.epics.map((e) =>
              e.id !== epicId ? e : {
                ...e,
                tasks: e.tasks.filter((t) => t.id !== tempId),
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
      const now = new Date().toISOString();

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
            tasks: [...e.tasks, tempTask],
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
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ epicId, title, status, priority: "medium", sortOrder: 9999 }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const realId = data.data.id as number;
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
            tasks: restTasks,
            epics: s.epics.map((e) =>
              e.id !== epicId ? e : {
                ...e,
                tasks: e.tasks.filter((t) => t.id !== tempId),
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
      const now = new Date().toISOString();

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
            tasks: [...e.tasks, tempTask],
            progress: { ...e.progress, total: e.progress.total + 1 },
          }
        ),
      }));

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
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ epicId, title, status, priority, sortOrder: 9999 }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const realId = data.data.id as number;
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
          return tempTask;
        }
        set((s) => {
          const restTasks = omitTask(s.tasks, tempId);
          return {
            tasks: restTasks,
            epics: s.epics.map((e) =>
              e.id !== epicId ? e : {
                ...e,
                tasks: e.tasks.filter((t) => t.id !== tempId),
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

      const prevStatus = task.status;
      const prevSubtasks = task.subtasks;
      const subtasksToUpdate: number[] = [];

      const updatedSubtasks = status === "done"
        ? task.subtasks.map((st) => {
          if (!st.isCompleted) { subtasksToUpdate.push(st.id); return { ...st, isCompleted: true }; }
          return st;
        })
        : task.subtasks;

      set((s) => {
        const doneCt = updatedSubtasks.filter((st) => st.isCompleted).length;
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

      if (taskId < 0) {
        const ops = await getPendingOps();
        const createOp = ops.find(
          (op): op is Extract<PendingOp, { kind: "create_with_relations" }> =>
            op.kind === "create_with_relations" && op.tempTaskId === taskId
        );
        if (createOp) {
          const mergedSubtasks: SubtaskDraft[] = updatedSubtasks.map((st) => ({
            isCompleted: st.isCompleted,
            sortOrder: st.sortOrder,
          }));
          await updatePendingOp({ ...createOp, status, subtasks: mergedSubtasks });
        }
        return;
      }

      if (isCurrentlyOffline()) {
        await enqueuePendingOp({
          kind: "patch_task",
          url: `/api/tasks/${taskId}`,
          patch: { status },
          expectedUpdatedAt: task.updatedAt,
        });
        for (const subtaskId of subtasksToUpdate) {
          await enqueuePendingOp({
            kind: undefined,
            url: `/api/subtasks/${subtaskId}`,
            method: "PATCH",
            body: { isCompleted: true },
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
      } catch (err) {
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: "patch_task",
            url: `/api/tasks/${taskId}`,
            patch: { status },
            expectedUpdatedAt: task.updatedAt,
          });
          for (const subtaskId of subtasksToUpdate) {
            await enqueuePendingOp({
              kind: undefined,
              url: `/api/subtasks/${subtaskId}`,
              method: "PATCH",
              body: { isCompleted: true },
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
              tasks: { ...s.tasks, [taskId]: rolled },
              epics: updateEpicsForTask(s.epics, taskId, (ts) => ts.map((t) => (t.id === taskId ? rolled : t))),
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
        const subs = task.subtasks.map((st) => st.id === subtaskId ? { ...st, isCompleted: newVal } : st);
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
      } catch (err) {
        if (isNetworkError(err) || isCurrentlyOffline()) {
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
              tasks: { ...s.tasks, [taskId]: rolledTask },
              epics: updateEpicsForTask(s.epics, taskId, (ts) => ts.map((t) => (t.id === taskId ? rolledTask : t))),
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
        const updated = { ...s.tasks[taskId], priority };
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
          kind: "patch_task",
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
      } catch (err) {
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: "patch_task",
            url: `/api/tasks/${taskId}`,
            patch: { priority },
            expectedUpdatedAt: get().tasks[taskId]?.updatedAt,
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], priority: prev } },
            syncStatus: "error",
          }));
        }
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
          kind: "patch_task",
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
      } catch (err) {
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: "patch_task",
            url: `/api/tasks/${taskId}`,
            patch: { title: patched },
            expectedUpdatedAt: get().tasks[taskId]?.updatedAt,
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], title: prev } },
            syncStatus: "error",
          }));
        }
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
          kind: "patch_task",
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
      } catch (err) {
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: "patch_task",
            url: `/api/tasks/${taskId}`,
            patch: { description: next },
            expectedUpdatedAt: get().tasks[taskId]?.updatedAt,
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], description: prev } },
            syncStatus: "error",
          }));
        }
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
          kind: "patch_task",
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
      } catch (err) {
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: "patch_task",
            url: `/api/tasks/${taskId}`,
            patch: { dueDate: dueDate ?? null },
            expectedUpdatedAt: get().tasks[taskId]?.updatedAt,
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], dueDate: prev } },
            syncStatus: "error",
          }));
        }
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
      } catch (err) {
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: undefined,
            url: `/api/tasks/${taskId}/assignees`,
            method: "POST",
            body: { userId: user.id },
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], assignees: s.tasks[taskId].assignees.filter((a) => a.id !== user.id) } },
            syncStatus: "error",
          }));
        }
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
      } catch (err) {
        if (isNetworkError(err) || isCurrentlyOffline()) {
          await enqueuePendingOp({
            kind: undefined,
            url: `/api/tasks/${taskId}/assignees/${userId}`,
            method: "DELETE",
          });
          set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        } else {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], assignees: prev } },
            syncStatus: "error",
          }));
        }
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
              tasks: e.tasks.filter((t) => t.id !== taskId),
              progress: {
                total: e.progress.total - 1,
                done: task.status === "done" ? e.progress.done - 1 : e.progress.done,
              },
            }
          ),
        };
      });

      const done = get()._beginOp();
      try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`status ${res.status}`);
      } catch (err) {
        if (epicSnapshot) {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: task },
            epics: s.epics.map((e) => (e.id === epicSnapshot.id ? epicSnapshot : e)),
            syncStatus: isNetworkError(err) ? "idle" : "error",
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
      status: s.syncStatus,
      lastSyncedAt: s.lastSyncedAt,
      offlineQueueSize: s.offlineQueueSize,
    }))
  );

export const useActiveEpic = () =>
  useTaskStore(
    useShallow((s) =>
      s.activeEpicId ? s.epics.find((e) => e.id === s.activeEpicId) : null
    )
  );