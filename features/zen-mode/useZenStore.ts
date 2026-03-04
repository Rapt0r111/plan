/**
 * @file useZenStore.ts — features/zen-mode
 *
 * ═══════════════════════════════════════════════════════════════
 * ZEN STATE MANAGER
 * ═══════════════════════════════════════════════════════════════
 *
 * ПСИХОЛОГИЯ ПОТОКОВОГО СОСТОЯНИЯ (Flow State):
 *
 *  Михай Чиксентмихайи (1990) доказал: Flow возможен только при полном
 *  устранении внешних отвлечений. В цифровой среде «отвлечение» = любой
 *  элемент UI, не относящийся к текущей задаче.
 *
 *  В военном контексте (этот проект) Flow State критически важен:
 *  высокая ответственность требует сфокусированного внимания,
 *  а когнитивная перегрузка от интерфейса напрямую снижает качество
 *  принимаемых решений (NASA SHERPA, 1996: -23% ошибок при упрощении UI).
 *
 * АРХИТЕКТУРА:
 *  Thin Zustand slice — не смешивается с TaskStore (доменная логика).
 *  Zen Mode — это UI-состояние, хранить рядом с данными задач неверно.
 */

import { create } from "zustand";
import type { TaskView } from "@/shared/types";

interface ZenStore {
  isActive: boolean;
  currentTask: TaskView | null;
  taskQueue: TaskView[];
  sessionStats: {
    completed: number;
    startedAt: Date | null;
  };

  activate: (task?: TaskView) => void;
  deactivate: () => void;
  setTask: (task: TaskView) => void;
  setQueue: (tasks: TaskView[]) => void;
  nextTask: () => void;
  markCompleted: () => void;
}

export const useZenStore = create<ZenStore>((set, get) => ({
  isActive: false,
  currentTask: null,
  taskQueue: [],
  sessionStats: { completed: 0, startedAt: null },

  activate: (task) =>
    set({
      isActive: true,
      currentTask: task ?? get().currentTask,
      sessionStats: { completed: 0, startedAt: new Date() },
    }),

  deactivate: () => set({ isActive: false }),

  setTask: (task) => set({ currentTask: task }),

  setQueue: (tasks) =>
    set({
      taskQueue: tasks,
      currentTask: tasks[0] ?? null,
    }),

  nextTask: () => {
    const { taskQueue, currentTask } = get();
    if (!currentTask) return;
    const idx = taskQueue.findIndex((t) => t.id === currentTask.id);
    const next = taskQueue[idx + 1] ?? null;
    set({ currentTask: next });
  },

  markCompleted: () => {
    set((s) => ({
      sessionStats: {
        ...s.sessionStats,
        completed: s.sessionStats.completed + 1,
      },
    }));
    get().nextTask();
  },
}));