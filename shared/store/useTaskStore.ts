/**
 * @file useTaskStore.ts — shared/store
 *
 * ОПТИМИЗАЦИИ v2:
 *
 * 1. REFERENCE STABILITY — epic mutations теперь возвращают тот же объект epic,
 *    если задача не принадлежит этому эпику. Без этого Zustand пересоздавал
 *    все epic-объекты при каждой мутации, что вызывало ре-рендер
 *    useTaskStore(s => s.getEpic(id)) во ВСЕХ EpicColumn компонентах.
 *    С этой оптимизацией — только затронутый эпик получает новый объект.
 *
 * 2. addTask — оптимистичное создание задачи прямо из доски.
 *    Temp ID (отрицательный timestamp) → API → замена реальным ID.
 *    Rollback при ошибке. Интегрируется с EpicColumn quick-add.
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { EpicWithTasks, TaskView, TaskStatus, TaskPriority } from "@/shared/types";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

interface TaskStore {
  epics: EpicWithTasks[];
  tasks: Record<number, TaskView>;
  activeEpicId: number | null;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  pendingOps: number;


  getEpic: (id: number) => EpicWithTasks | undefined;
  getTask: (id: number) => TaskView | undefined;
  getTasksForEpic: (epicId: number) => TaskView[];
  hydrateEpics: (epics: EpicWithTasks[]) => void;
  setActiveEpic: (epicId: number | null) => void;
  addTask: (epicId: number, title: string, status?: TaskStatus) => Promise<void>;
  createTask: (params: { epicId: number; title: string; status?: TaskStatus; priority?: TaskPriority }) => Promise<TaskView | null>;
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
  _beginOp: () => () => void;
}

function buildTaskIndex(epics: EpicWithTasks[]): Record<number, TaskView> {
  const index: Record<number, TaskView> = {};
  for (const epic of epics) {
    for (const task of epic.tasks) { index[task.id] = task; }
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

/**
 * updateEpicsForTask — обновляет только эпик с taskId, остальные возвращает as-is.
 * Ключевая оптимизация: стабильные ссылки → EpicColumn не ре-рендерится зря.
 */
function updateEpicsForTask(
  epics: EpicWithTasks[],
  taskId: number,
  updater: (tasks: TaskView[]) => TaskView[],
): EpicWithTasks[] {
  return epics.map((epic) => {
    if (!epic.tasks.some((t) => t.id === taskId)) return epic; // ← стабильная ссылка
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

export const useTaskStore = create<TaskStore>()(
  subscribeWithSelector((set, get) => ({
    epics: [], tasks: {}, activeEpicId: null,
    syncStatus: "idle", lastSyncedAt: null, pendingOps: 0,

    getEpic: (id) => get().epics.find((e) => e.id === id),
    getTask: (id) => get().tasks[id],
    getTasksForEpic: (epicId) => get().epics.find((e) => e.id === epicId)?.tasks ?? [],

    hydrateEpics: (epics) => set({
      epics, tasks: buildTaskIndex(epics),
      syncStatus: "synced", lastSyncedAt: new Date(),
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

    // ── addTask ──────────────────────────────────────────────────────────────
    addTask: async (epicId, title, status = "todo") => {
      let _tempIdCounter = 0;
      const nextTempId = () => -(++_tempIdCounter);
      const tempId = nextTempId();
      const now = new Date().toISOString();

      const tempTask: TaskView = {
        id: tempId,
        epicId,
        title,
        description: null,
        status,
        priority: "medium",
        dueDate: null,
        sortOrder: 9999,
        createdAt: now,
        updatedAt: now,
        assignees: [],
        subtasks: [],
        progress: { done: 0, total: 0 },
      };

      // Оптимистичное добавление
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

      const done = get()._beginOp();
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            epicId,
            title,
            status,
            priority: "medium",
            sortOrder: 9999,
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const realId: number = data.data.id;
        const realTask: TaskView = { ...tempTask, id: realId };

        // Заменяем temp-задачу на реальную
        set((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [tempId]: _removed, ...restTasks } = s.tasks;
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
        // Откат
        set((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [tempId]: _removed, ...restTasks } = s.tasks;
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
    // Thin wrapper over addTask that accepts a params object and returns the
    // created TaskView (or null on error) — used by QuickAddTask in EpicColumn.
    createTask: async ({ epicId, title, status = "todo", priority = "medium" }) => {
      const tempId = -(Date.now());
      const now = new Date().toISOString();

      const tempTask: TaskView = {
        id: tempId, epicId, title, description: null,
        status, priority, dueDate: null, sortOrder: 9999,
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

      const done = get()._beginOp();
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ epicId, title, status, priority, sortOrder: 9999 }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const realId: number = data.data.id;
        const realTask: TaskView = { ...tempTask, id: realId };

        set((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [tempId]: _removed, ...restTasks } = s.tasks;
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [tempId]: _removed, ...restTasks } = s.tasks;
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

    // ── updateTaskStatus ─────────────────────────────────────────────────────
    updateTaskStatus: async (taskId, status) => {
      const task = get().tasks[taskId];
      if (!task || task.status === status) return;

      const prevStatus = task.status;
      const prevSubtasks = task.subtasks;

      // Авто-завершение подзадач при статусе "done"
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
          ...s.tasks[taskId],
          status,
          subtasks: updatedSubtasks,
          progress: { total: updatedSubtasks.length, done: doneCt },
        };
        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: updateEpicsForTask(s.epics, taskId, (tasks) =>
            tasks.map((t) => (t.id === taskId ? updated : t))
          ),
        };
      });

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
        set((s) => {
          const rolledDoneCt = prevSubtasks.filter((st) => st.isCompleted).length;
          const rolled: TaskView = {
            ...s.tasks[taskId],
            status: prevStatus,
            subtasks: prevSubtasks,
            progress: { total: prevSubtasks.length, done: rolledDoneCt },
          };
          return {
            tasks: { ...s.tasks, [taskId]: rolled },
            epics: updateEpicsForTask(s.epics, taskId, (tasks) =>
              tasks.map((t) => (t.id === taskId ? rolled : t))
            ),
            syncStatus: "error",
          };
        });
      } finally {
        done();
      }
    },

    // ── updateTaskPriority ───────────────────────────────────────────────────
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

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/tasks/${taskId}`, { priority });
      } catch {
        set((s) => {
          const rolled: TaskView = { ...s.tasks[taskId], priority: prev };
          return {
            tasks: { ...s.tasks, [taskId]: rolled },
            epics: updateEpicsForTask(s.epics, taskId, (tasks) =>
              tasks.map((t) => (t.id === taskId ? rolled : t))
            ),
            syncStatus: "error",
          };
        });
      } finally {
        done();
      }
    },

    // ── toggleSubtask ────────────────────────────────────────────────────────
    toggleSubtask: async (taskId, subtaskId, current) => {
      const newVal = !current;

      set((s) => {
        const task = s.tasks[taskId];
        if (!task) return s;
        const subs = task.subtasks.map((st) =>
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

      const done = get()._beginOp();
      try {
        await apiPatch(`/api/subtasks/${subtaskId}`, { isCompleted: newVal });
      } catch {
        set((s) => {
          const task = s.tasks[taskId];
          if (!task) return s;
          const rolled = task.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, isCompleted: current } : st
          );
          const rolledDone = rolled.filter((st) => st.isCompleted).length;
          const rolledTask: TaskView = { ...task, subtasks: rolled, progress: { done: rolledDone, total: rolled.length } };
          return {
            tasks: { ...s.tasks, [taskId]: rolledTask },
            epics: updateEpicsForTask(s.epics, taskId, (tasks) =>
              tasks.map((t) => (t.id === taskId ? rolledTask : t))
            ),
            syncStatus: "error",
          };
        });
      } finally {
        done();
      }
    },
    // В useTaskStore нет deleteTask — добавить:
    deleteTask: async (taskId: number) => {
      const task = get().tasks[taskId];
      if (!task) return;

      // Сохраняем snapshot для rollback
      const epicSnapshot = get().epics.find((e) => e.id === task.epicId);

      // Оптимистичное удаление
      set((s) => {
        const { [taskId]: _removed, ...restTasks } = s.tasks;
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
        if (!res.ok) throw new Error(`DELETE failed: ${res.status}`);
      } catch {
        // Rollback
        if (epicSnapshot) {
          set((s) => ({
            tasks: { ...s.tasks, [taskId]: task },
            epics: s.epics.map((e) => (e.id === epicSnapshot.id ? epicSnapshot : e)),
            syncStatus: "error",
          }));
        }
      } finally {
        done();
      }
    },
    // ── reorderTasks ─────────────────────────────────────────────────────────
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
      const done = get()._beginOp();
      try { await apiPatch(`/api/tasks/${taskId}`, { title: patched }); }
      catch {
        set((s) => {
          const rolled = { ...s.tasks[taskId], title: prev };
          return {
            tasks: { ...s.tasks, [taskId]: rolled },
            epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
            syncStatus: "error",
          };
        });
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
      const done = get()._beginOp();
      try { await apiPatch(`/api/tasks/${taskId}`, { description: next }); }
      catch {
        set((s) => {
          const rolled = { ...s.tasks[taskId], description: prev };
          return {
            tasks: { ...s.tasks, [taskId]: rolled },
            epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
            syncStatus: "error",
          };
        });
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
      const done = get()._beginOp();
      try { await apiPatch(`/api/tasks/${taskId}`, { dueDate }); }
      catch {
        set((s) => {
          const rolled = { ...s.tasks[taskId], dueDate: prev };
          return {
            tasks: { ...s.tasks, [taskId]: rolled },
            epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
            syncStatus: "error",
          };
        });
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
      const done = get()._beginOp();
      try {
        const res = await fetch(`/api/tasks/${taskId}/assignees`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        if (!res.ok) throw new Error(`POST assignee failed: ${res.status}`);
      } catch {
        set((s) => {
          const rolled = { ...s.tasks[taskId], assignees: s.tasks[taskId].assignees.filter((a) => a.id !== user.id) };
          return {
            tasks: { ...s.tasks, [taskId]: rolled },
            epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
            syncStatus: "error",
          };
        });
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
      const done = get()._beginOp();
      try {
        const res = await fetch(`/api/tasks/${taskId}/assignees/${userId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`DELETE assignee failed: ${res.status}`);
      } catch {
        set((s) => {
          const rolled = { ...s.tasks[taskId], assignees: prev };
          return {
            tasks: { ...s.tasks, [taskId]: rolled },
            epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
            syncStatus: "error",
          };
        });
      } finally { done(); }
    },

  }))
);

export const useSyncStatus = () =>
  useTaskStore(
    useShallow((s) => ({
      status: s.syncStatus,
      lastSyncedAt: s.lastSyncedAt,
    }))
  );

export const useActiveEpic = () =>
  useTaskStore(
    useShallow((s) =>
      s.activeEpicId ? s.epics.find((e) => e.id === s.activeEpicId) : null
    )
  );