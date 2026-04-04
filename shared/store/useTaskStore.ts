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

/** Dedup tasks in an epic by ID, keeping first occurrence */
function dedupTasks(tasks: TaskView[]): TaskView[] {
  const seen = new Set<number>();
  return tasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/** Replace tempId with realTask in epic\'s task list, with dedup to prevent duplicates */
function replaceTempTask(
  epics: EpicWithTasks[],
  epicId: number,
  tempId: number,
  realTask: TaskView,
): EpicWithTasks[] {
  return epics.map((e) => {
    if (e.id !== epicId) return e;
    const tasks = dedupTasks(e.tasks.map((t) => (t.id === tempId ? realTask : t)));
    return { ...e, tasks };
  });
}

interface TaskStore {
  epics: EpicWithTasks[];
  tasks: Record<number, TaskView>;
  activeEpicId: number | null;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  pendingOps: number;
  offlineQueueSize: number;
  mutatingTaskIds: Set<number>;
  replayingTempIds: Set<number>;
  /** FIX: track temp epic IDs being replayed to prevent duplication in hydrateEpics */
  replayingTempEpicIds: Set<number>;
  /** FIX: task IDs with pending offline patch ops — preserved across hydrateEpics calls */
  pendingPatchTaskIds: Set<number>;

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
  _trackMutation: (taskId: number) => () => void;
}

export const useTaskStore = create<TaskStore>()(
  subscribeWithSelector((set, get) => ({
    epics: [],
    tasks: {},
    activeEpicId: null,
    syncStatus: "idle",
    lastSyncedAt: null,
    pendingOps: 0,
    offlineQueueSize: 0,
    mutatingTaskIds: new Set<number>(),
    replayingTempIds: new Set<number>(),
    replayingTempEpicIds: new Set<number>(),
    pendingPatchTaskIds: new Set<number>(),

    getEpic: (id) => get().epics.find((e) => e.id === id),
    getTask: (id) => get().tasks[id],
    getTasksForEpic: (epicId) => get().epics.find((e) => e.id === epicId)?.tasks ?? [],

    // ─────────────────────────────────────────────────────────────────────────
    // hydrateEpics v14 — FIX: use replayingTempEpicIds + pendingPatchTaskIds
    //
    // BUG FIXED 1: Epic duplication during sync
    //   BEFORE: tempEpics = s.epics.filter((e) => e.id < 0)
    //           When SSE fires during epic replay, both temp AND real epic appear.
    //   AFTER:  Filter out temp epics that are currently being replayed.
    //
    // BUG FIXED 2: Status/priority reverting after offline change
    //   BEFORE: Only mutatingTaskIds (active fetches) preserved across hydrateEpics.
    //           Queued offline patches were ignored → server data overwrites optimistic state.
    //   AFTER:  pendingPatchTaskIds also preserved — tasks with queued patches keep
    //           their optimistic state until the patch is actually replayed.
    // ─────────────────────────────────────────────────────────────────────────
    hydrateEpics: (serverEpics) => set((s) => {
      // Step 1: preserve temp epics (id < 0) that are NOT currently being replayed
      // FIX v14: exclude epics in replayingTempEpicIds to prevent duplication
      const tempEpics = s.epics.filter((e) => e.id < 0 && !s.replayingTempEpicIds.has(e.id));

      // Step 2: collect temp tasks grouped by their real epicId
      // Skip temp tasks currently being replayed (they must not be injected
      // alongside the server\'s real task which the SSE just brought).
      const allTempTasks: Record<number, TaskView> = {};
      const pendingByEpic: Record<number, TaskView[]> = {};

      for (const [idStr, task] of Object.entries(s.tasks)) {
        const id = Number(idStr);
        if (id < 0 && !s.replayingTempIds.has(id)) {
          allTempTasks[id] = task;
          if (task.epicId > 0) {
            (pendingByEpic[task.epicId] ??= []).push(task);
          }
        }
      }

      // Step 3: inject pending temp tasks + preserve mutating + preserve offline patches
      // FIX v14: include pendingPatchTaskIds so offline status/priority changes are NOT
      // overwritten by server data before the patch_task op is replayed.
      const preserveIds = new Set([...s.mutatingTaskIds, ...s.pendingPatchTaskIds]);

      const serverEpicsWithPending = serverEpics.map((epic) => {
        const pending = pendingByEpic[epic.id];

        const tasks = epic.tasks.map((serverTask) => {
          if (preserveIds.has(serverTask.id) && s.tasks[serverTask.id]) {
            return s.tasks[serverTask.id];
          }
          return serverTask;
        });

        if (!pending?.length) {
          return { ...epic, tasks };
        }
        const allTasks = [...tasks, ...pending];
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

      // Deduplicate epics (race condition guard)
      const seenEpicIds = new Set<number>();
      const dedupedEpics = mergedEpics
        .filter(e => {
          if (seenEpicIds.has(e.id)) return false;
          seenEpicIds.add(e.id);
          return true;
        })
        .map(epic => ({
          ...epic,
          tasks: dedupTasks(epic.tasks),
        }));

      // Build tasks index: server + temp + preserve mutating/patching
      const serverTasks = buildTaskIndex(serverEpics);
      const mergedTasks: Record<number, TaskView> = { ...serverTasks, ...allTempTasks };

      if (preserveIds.size > 0) {
        for (const id of preserveIds) {
          if (s.tasks[id]) mergedTasks[id] = s.tasks[id];
        }
      }

      return {
        epics: dedupedEpics,
        tasks: mergedTasks,
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

    _trackMutation: (taskId: number) => {
      if (taskId <= 0) return () => {};
      set((s) => ({ mutatingTaskIds: new Set([...s.mutatingTaskIds, taskId]) }));
      return () => {
        set((s) => {
          const ids = new Set(s.mutatingTaskIds);
          ids.delete(taskId);
          return { mutatingTaskIds: ids };
        });
      };
    },

    // ── refreshOfflineQueue ───────────────────────────────────────────────────
    // FIX v14: also restore pendingPatchTaskIds from IDB on mount so that
    // tasks with queued offline patches are preserved across page refreshes.
    refreshOfflineQueue: async () => {
      try {
        const ops = await getPendingOps();
        // Rebuild pendingPatchTaskIds from queued patch_task ops
        const patchTaskIds = new Set<number>();
        for (const op of ops) {
          if (op.kind === "patch_task") {
            const m = op.url.match(/\/api\/tasks\/(\d+)/);
            if (m && Number(m[1]) > 0) {
              patchTaskIds.add(Number(m[1]));
            }
          }
        }
        set({ offlineQueueSize: ops.length, pendingPatchTaskIds: patchTaskIds });
      } catch {
        const count = await getPendingOpsCount();
        set({ offlineQueueSize: count });
      }
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

        set((s) => {
          const seenIds = new Set<number>();
          const epics = s.epics
            .map((e) =>
              e.id === tempId
                ? { ...tempEpic, id: realId, createdAt: realEpic.createdAt, updatedAt: realEpic.updatedAt }
                : e
            )
            .filter(e => {
              if (seenIds.has(e.id)) return false;
              seenIds.add(e.id);
              return true;
            });
          return { epics };
        });

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

        // FIX v14: mark temp epic as replaying BEFORE the fetch
        // This prevents hydrateEpics (from SSE) from showing the temp epic
        // alongside the newly created real epic during the async window.
        set((s) => ({
          replayingTempEpicIds: new Set([...s.replayingTempEpicIds, op.tempEpicId]),
        }));

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
              const replayingTempEpicIds = new Set(s.replayingTempEpicIds);
              replayingTempEpicIds.delete(op.tempEpicId);

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

              return { epics: updatedEpics, tasks: updatedTasks, replayingTempEpicIds };
            });

            cacheEpics(get().epics);
            await removePendingOp(op.id);
            successCount++;
            set((s) => ({ offlineQueueSize: Math.max(0, s.offlineQueueSize - 1) }));

          } else if (res.status >= 400 && res.status < 500) {
            await removePendingOp(op.id);
            droppedCount++;
            set((s) => {
              const replayingTempEpicIds = new Set(s.replayingTempEpicIds);
              replayingTempEpicIds.delete(op.tempEpicId);
              return {
                offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                replayingTempEpicIds,
              };
            });
          } else {
            if (op.retries >= MAX_OP_RETRIES) {
              await removePendingOp(op.id);
              droppedCount++;
              set((s) => {
                const replayingTempEpicIds = new Set(s.replayingTempEpicIds);
                replayingTempEpicIds.delete(op.tempEpicId);
                return {
                  offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                  replayingTempEpicIds,
                };
              });
            } else {
              // On retry: unmark so the next replay attempt can re-mark it
              set((s) => {
                const replayingTempEpicIds = new Set(s.replayingTempEpicIds);
                replayingTempEpicIds.delete(op.tempEpicId);
                return { replayingTempEpicIds };
              });
              await incrementOpRetries(op.id);
            }
          }
        } catch {
          // Network error: unmark and stop
          set((s) => {
            const replayingTempEpicIds = new Set(s.replayingTempEpicIds);
            replayingTempEpicIds.delete(op.tempEpicId);
            return { replayingTempEpicIds };
          });
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

            set((s) => ({
              replayingTempIds: new Set([...s.replayingTempIds, op.tempTaskId]),
            }));

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
                const replayingTempIds = new Set(s.replayingTempIds);
                replayingTempIds.delete(op.tempTaskId);

                if (!tempTask) {
                  return { ...s, replayingTempIds };
                }

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
                  replayingTempIds,
                  epics: s.epics.map((e) => {
                    if (e.id !== epicId) return e;
                    return {
                      ...e,
                      tasks: dedupTasks(e.tasks.map((t) => t.id === op.tempTaskId ? realTask : t)),
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
              set((s) => {
                const replayingTempIds = new Set(s.replayingTempIds);
                replayingTempIds.delete(op.tempTaskId);
                return {
                  offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                  replayingTempIds,
                };
              });
            } else {
              if (op.retries >= MAX_OP_RETRIES) {
                await removePendingOp(op.id);
                droppedCount++;
                set((s) => {
                  const replayingTempIds = new Set(s.replayingTempIds);
                  replayingTempIds.delete(op.tempTaskId);
                  return {
                    offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                    replayingTempIds,
                  };
                });
              } else {
                set((s) => {
                  const replayingTempIds = new Set(s.replayingTempIds);
                  replayingTempIds.delete(op.tempTaskId);
                  return { replayingTempIds };
                });
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

            const taskIdMatch = url.match(/\/api\/tasks\/(\d+)/);
            const replayTaskId = taskIdMatch ? Number(taskIdMatch[1]) : 0;
            const stopTrackingPatch = replayTaskId > 0
              ? get()._trackMutation(replayTaskId)
              : () => {};

            const res = await apiPatch(url, { ...patch, expectedUpdatedAt });

            if (res.ok) {
              await removePendingOp(op.id);
              successCount++;
              // FIX v14: clear from pendingPatchTaskIds on successful replay
              set((s) => {
                const pendingPatchTaskIds = new Set(s.pendingPatchTaskIds);
                if (replayTaskId > 0) pendingPatchTaskIds.delete(replayTaskId);
                return {
                  offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                  pendingPatchTaskIds,
                };
              });
              stopTrackingPatch();
            } else if (res.status === 409) {
              const conflictTaskIdMatch = url.match(/\/api\/tasks\/(\d+)/);
              if (!conflictTaskIdMatch) {
                await removePendingOp(op.id);
                droppedCount++;
                set((s) => {
                  const pendingPatchTaskIds = new Set(s.pendingPatchTaskIds);
                  if (replayTaskId > 0) pendingPatchTaskIds.delete(replayTaskId);
                  return {
                    offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                    pendingPatchTaskIds,
                  };
                });
                stopTrackingPatch();
                continue;
              }
              const taskId = Number(conflictTaskIdMatch[1]);

              const currentRes = await fetch(`/api/tasks/${taskId}`);
              if (!currentRes.ok) {
                await removePendingOp(op.id);
                droppedCount++;
                set((s) => {
                  const pendingPatchTaskIds = new Set(s.pendingPatchTaskIds);
                  if (replayTaskId > 0) pendingPatchTaskIds.delete(replayTaskId);
                  return {
                    offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                    pendingPatchTaskIds,
                  };
                });
                stopTrackingPatch();
                continue;
              }

              const currentData = await currentRes.json();
              const currentTask: TaskView = currentData.data;
              expectedUpdatedAt = currentTask.updatedAt;

              const rebaseRes = await apiPatch(url, { ...patch, expectedUpdatedAt });

              if (rebaseRes.ok) {
                const mergedTask = { ...currentTask, ...patch };
                set((s) => {
                  const pendingPatchTaskIds = new Set(s.pendingPatchTaskIds);
                  if (replayTaskId > 0) pendingPatchTaskIds.delete(replayTaskId);
                  return {
                    tasks: { ...s.tasks, [taskId]: mergedTask as TaskView },
                    epics: updateEpicsForTask(s.epics, taskId, (tasks) =>
                      tasks.map((t) => t.id === taskId ? mergedTask as TaskView : t)
                    ),
                    offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                    pendingPatchTaskIds,
                  };
                });
                await removePendingOp(op.id);
                successCount++;
              } else {
                await removePendingOp(op.id);
                droppedCount++;
                set((s) => {
                  const pendingPatchTaskIds = new Set(s.pendingPatchTaskIds);
                  if (replayTaskId > 0) pendingPatchTaskIds.delete(replayTaskId);
                  return {
                    offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                    pendingPatchTaskIds,
                  };
                });
              }
              stopTrackingPatch();
            } else if (res.status >= 400 && res.status < 500) {
              await removePendingOp(op.id);
              droppedCount++;
              set((s) => {
                const pendingPatchTaskIds = new Set(s.pendingPatchTaskIds);
                if (replayTaskId > 0) pendingPatchTaskIds.delete(replayTaskId);
                return {
                  offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                  pendingPatchTaskIds,
                };
              });
              stopTrackingPatch();
            } else {
              if (op.retries >= MAX_OP_RETRIES) {
                await removePendingOp(op.id);
                droppedCount++;
                set((s) => {
                  const pendingPatchTaskIds = new Set(s.pendingPatchTaskIds);
                  if (replayTaskId > 0) pendingPatchTaskIds.delete(replayTaskId);
                  return {
                    offlineQueueSize: Math.max(0, s.offlineQueueSize - 1),
                    pendingPatchTaskIds,
                  };
                });
              } else {
                await incrementOpRetries(op.id);
              }
              stopTrackingPatch();
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
          // Network error: clear all replay/mutation tracking
          set((s) => {
            const hasTracking = s.replayingTempIds.size > 0 || s.mutatingTaskIds.size > 0 || s.replayingTempEpicIds.size > 0;
            if (!hasTracking) return s;
            return {
              replayingTempIds: new Set<number>(),
              mutatingTaskIds: new Set<number>(),
              replayingTempEpicIds: new Set<number>(),
            };
          });
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
            epics: replaceTempTask(s.epics, epicId, tempId, realTask),
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
            epics: replaceTempTask(s.epics, epicId, tempId, realTask),
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
            epics: replaceTempTask(s.epics, epicId, tempId, realTask),
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
        // FIX v14: track taskId so hydrateEpics preserves the optimistic status
        set((s) => ({
          offlineQueueSize: s.offlineQueueSize + 1 + subtasksToUpdate.length,
          pendingPatchTaskIds: new Set([...s.pendingPatchTaskIds, taskId]),
        }));
        return;
      }

      const stopTracking = get()._trackMutation(taskId);
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
          // FIX v14: track taskId for offline patch
          set((s) => ({
            offlineQueueSize: s.offlineQueueSize + 1 + subtasksToUpdate.length,
            pendingPatchTaskIds: new Set([...s.pendingPatchTaskIds, taskId]),
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
        stopTracking();
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

      const stopTracking = get()._trackMutation(taskId);
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
        stopTracking();
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
        // FIX v14: track for hydrateEpics preservation
        set((s) => ({
          offlineQueueSize: s.offlineQueueSize + 1,
          pendingPatchTaskIds: new Set([...s.pendingPatchTaskIds, taskId]),
        }));
        return;
      }

      const stopTracking = get()._trackMutation(taskId);
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
          set((s) => ({
            offlineQueueSize: s.offlineQueueSize + 1,
            pendingPatchTaskIds: new Set([...s.pendingPatchTaskIds, taskId]),
          }));
        } else {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], priority: prev } },
            syncStatus: "error",
          }));
        }
      } finally {
        done();
        stopTracking();
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
        set((s) => ({
          offlineQueueSize: s.offlineQueueSize + 1,
          pendingPatchTaskIds: new Set([...s.pendingPatchTaskIds, taskId]),
        }));
        return;
      }

      const stopTracking = get()._trackMutation(taskId);
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
          set((s) => ({
            offlineQueueSize: s.offlineQueueSize + 1,
            pendingPatchTaskIds: new Set([...s.pendingPatchTaskIds, taskId]),
          }));
        } else {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], title: prev } },
            syncStatus: "error",
          }));
        }
      } finally {
        done();
        stopTracking();
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
        await enqueuePendingOp({
          kind: "patch_task",
          url: `/api/tasks/${taskId}`,
          patch: { description: next },
          expectedUpdatedAt: get().tasks[taskId]?.updatedAt,
        });
        set((s) => ({
          offlineQueueSize: s.offlineQueueSize + 1,
          pendingPatchTaskIds: taskId > 0
            ? new Set([...s.pendingPatchTaskIds, taskId])
            : s.pendingPatchTaskIds,
        }));
        return;
      }

      const stopTracking = get()._trackMutation(taskId);
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
          set((s) => ({
            offlineQueueSize: s.offlineQueueSize + 1,
            pendingPatchTaskIds: taskId > 0
              ? new Set([...s.pendingPatchTaskIds, taskId])
              : s.pendingPatchTaskIds,
          }));
        } else {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], description: prev } },
            syncStatus: "error",
          }));
        }
      } finally {
        done();
        stopTracking();
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
        await enqueuePendingOp({
          kind: "patch_task",
          url: `/api/tasks/${taskId}`,
          patch: { dueDate: dueDate ?? null },
          expectedUpdatedAt: get().tasks[taskId]?.updatedAt,
        });
        set((s) => ({
          offlineQueueSize: s.offlineQueueSize + 1,
          pendingPatchTaskIds: taskId > 0
            ? new Set([...s.pendingPatchTaskIds, taskId])
            : s.pendingPatchTaskIds,
        }));
        return;
      }

      const stopTracking = get()._trackMutation(taskId);
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
          set((s) => ({
            offlineQueueSize: s.offlineQueueSize + 1,
            pendingPatchTaskIds: taskId > 0
              ? new Set([...s.pendingPatchTaskIds, taskId])
              : s.pendingPatchTaskIds,
          }));
        } else {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], dueDate: prev } },
            syncStatus: "error",
          }));
        }
      } finally {
        done();
        stopTracking();
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

      const stopTracking = get()._trackMutation(taskId);
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
      } finally {
        done();
        stopTracking();
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
          kind: undefined,
          url: `/api/tasks/${taskId}/assignees/${userId}`,
          method: "DELETE",
        });
        set((s) => ({ offlineQueueSize: s.offlineQueueSize + 1 }));
        return;
      }

      const stopTracking = get()._trackMutation(taskId);
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
      } finally {
        done();
        stopTracking();
      }
    },

    // ── deleteTask ────────────────────────────────────────────────────────────
    deleteTask: async (taskId) => {
      const task = get().tasks[taskId];
      if (!task) return;
      const epicSnapshot = get().epics.find((e) => e.id === task.epicId);

      set((s) => {
        const restTasks = omitTask(s.tasks, taskId);
        // Also remove from pendingPatchTaskIds if present
        const pendingPatchTaskIds = new Set(s.pendingPatchTaskIds);
        pendingPatchTaskIds.delete(taskId);
        return {
          tasks: restTasks,
          pendingPatchTaskIds,
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