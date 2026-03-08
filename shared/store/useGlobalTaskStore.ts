// НОВЫЙ ФАЙЛ: shared/store/useGlobalTaskStore.ts
import { create } from "zustand";

interface GlobalTaskStore {
  pendingOpenTaskId: number | null;
  openTask: (id: number) => void;
  clearPendingTask: () => void;
}

export const useGlobalTaskStore = create<GlobalTaskStore>((set) => ({
  pendingOpenTaskId: null,
  openTask: (id) => set({ pendingOpenTaskId: id }),
  clearPendingTask: () => set({ pendingOpenTaskId: null }),
}));