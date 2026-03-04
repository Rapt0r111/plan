/**
 * @file useTaskStore.ts - shared/store
 * Local-first state management with Zustand.
 * Optimistic updates ensure instant UI feedback (<16ms) before DB round-trip.
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
  updateTaskStatus: (taskId: number, status: TaskStatus) => Promise<void>;
  updateTaskPriority: (taskId: number, priority: TaskPriority) => Promise<void>;
  toggleSubtask: (taskId: number, subtaskId: number, current: boolean) => Promise<void>;
  reorderTasks: (epicId: number, orderedIds: number[]) => Promise<void>;
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
        return { pendingOps: next, syncStatus: next === 0 ? "synced" : "syncing",
          lastSyncedAt: next === 0 ? new Date() : s.lastSyncedAt };
      });
    },

    updateTaskStatus: async (taskId, status) => {
      const task = get().tasks[taskId];
      if (!task || task.status === status) return;
      
      const prevStatus = task.status;
      const prevSubtasks = task.subtasks;

      // 1. Собираем подзадачи, которые нужно автоматически завершить
      const shouldCompleteSubtasks = status === "done";
      let updatedSubtasks = task.subtasks;
      
      // ИСПРАВЛЕНИЕ: используем const, так как мы только мутируем массив (push), а не переназначаем его
      const subtasksToUpdate: number[] = [];

      if (shouldCompleteSubtasks) {
        updatedSubtasks = task.subtasks.map(st => {
          if (!st.isCompleted) {
            subtasksToUpdate.push(st.id);
            return { ...st, isCompleted: true };
          }
          return st;
        });
      }

      // 2. Оптимистичное обновление стора
      set((s) => {
        const doneCt = updatedSubtasks.filter(st => st.isCompleted).length;
        const updated = { 
          ...s.tasks[taskId], 
          status, 
          subtasks: updatedSubtasks,
          progress: { total: updatedSubtasks.length, done: doneCt }
        };

        return {
          tasks: { ...s.tasks, [taskId]: updated },
          epics: s.epics.map((epic) => ({
            ...epic,
            tasks: epic.tasks.map((t) => (t.id === taskId ? updated : t)),
            progress: {
              total: epic.tasks.length,
              done: epic.tasks.map((t) => (t.id === taskId ? updated : t)).filter((t) => t.status === "done").length,
            },
          })),
        };
      });

      // 3. Отправка запросов к API
      const done = get()._beginOp();
      try { 
        await apiPatch(`/api/tasks/${taskId}`, { status }); 
        
        // Отправляем патчи для каждой измененной подзадачи параллельно
        if (subtasksToUpdate.length > 0) {
          await Promise.all(
            subtasksToUpdate.map(id => apiPatch(`/api/subtasks/${id}`, { isCompleted: true }))
          );
        }
      } catch {
        // 4. Откат изменений при ошибке
        set((s) => {
          const rolledDoneCt = prevSubtasks.filter(st => st.isCompleted).length;
          const rolled = { 
            ...s.tasks[taskId], 
            status: prevStatus, 
            subtasks: prevSubtasks,
            progress: { total: prevSubtasks.length, done: rolledDoneCt }
          };
          return { 
            tasks: { ...s.tasks, [taskId]: rolled },
            epics: s.epics.map((e) => ({ 
              ...e, 
              tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)),
              progress: {
                total: e.tasks.length,
                done: e.tasks.map((t) => (t.id === taskId ? rolled : t)).filter((t) => t.status === "done").length,
              }
            })),
            syncStatus: "error" 
          };
        });
      } finally { done(); }
    },

    updateTaskPriority: async (taskId, priority) => {
      const prev = get().tasks[taskId]?.priority;
      if (!prev || prev === priority) return;
      set((s) => {
        const updated = { ...s.tasks[taskId], priority };
        return { tasks: { ...s.tasks, [taskId]: updated },
          epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? updated : t)) })) };
      });
      const done = get()._beginOp();
      try { await apiPatch(`/api/tasks/${taskId}`, { priority }); }
      catch {
        set((s) => {
          const rolled = { ...s.tasks[taskId], priority: prev };
          return { tasks: { ...s.tasks, [taskId]: rolled },
            epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolled : t)) })),
            syncStatus: "error" };
        });
      } finally { done(); }
    },

    toggleSubtask: async (taskId, subtaskId, current) => {
      const newVal = !current;
      set((s) => {
        const task = s.tasks[taskId];
        if (!task) return s;
        const subs = task.subtasks.map((st) => st.id === subtaskId ? { ...st, isCompleted: newVal } : st);
        const doneCt = subs.filter((st) => st.isCompleted).length;
        const updated: TaskView = { ...task, subtasks: subs, progress: { done: doneCt, total: subs.length } };
        return { tasks: { ...s.tasks, [taskId]: updated },
          epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? updated : t)) })) };
      });
      const done = get()._beginOp();
      try { await apiPatch(`/api/subtasks/${subtaskId}`, { isCompleted: newVal }); }
      catch {
        set((s) => {
          const task = s.tasks[taskId];
          if (!task) return s;
          const rolled = task.subtasks.map((st) => st.id === subtaskId ? { ...st, isCompleted: current } : st);
          const rolledDone = rolled.filter((st) => st.isCompleted).length;
          const rolledTask = { ...task, subtasks: rolled, progress: { done: rolledDone, total: rolled.length } };
          return { tasks: { ...s.tasks, [taskId]: rolledTask },
            epics: s.epics.map((e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? rolledTask : t)) })),
            syncStatus: "error" };
        });
      } finally { done(); }
    },

    reorderTasks: async (epicId, orderedIds) => {
      const prevOrder = get().epics.find((e) => e.id === epicId)?.tasks.map((t) => t.id);
      set((s) => ({
        epics: s.epics.map((e) => {
          if (e.id !== epicId) return e;
          const taskMap = Object.fromEntries(e.tasks.map((t) => [t.id, t]));
          return { ...e, tasks: orderedIds.filter((id) => taskMap[id]).map((id, idx) => ({ ...taskMap[id], sortOrder: idx })) };
        }),
      }));
      const done = get()._beginOp();
      try { await Promise.all(orderedIds.map((id, idx) => apiPatch(`/api/tasks/${id}`, { sort_order: idx }))); }
      catch {
        if (prevOrder) {
          set((s) => ({
            epics: s.epics.map((e) => {
              if (e.id !== epicId) return e;
              const taskMap = Object.fromEntries(e.tasks.map((t) => [t.id, t]));
              return { ...e, tasks: prevOrder.map((id) => taskMap[id]).filter(Boolean) as TaskView[] };
            }), syncStatus: "error",
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
      lastSyncedAt: s.lastSyncedAt 
    }))
  );

export const useActiveEpic = () =>
  useTaskStore(
    useShallow((s) => 
      s.activeEpicId ? s.epics.find((e) => e.id === s.activeEpicId) : null
    )
  );