/**
 * @file useCommandPaletteStore.ts — features/command-palette
 *
 * Thin Zustand slice that owns the open/closed state of the Command Palette.
 * Kept separate from useTaskStore to avoid coupling — the palette is a
 * cross-cutting concern, not a task-domain concern.
 *
 * Any component in the tree can call openPalette() without prop-drilling.
 */

import { create } from "zustand";

interface CommandPaletteStore {
  isOpen: boolean;
  /** Optional pre-filled query — lets deeplinks open with context */
  initialQuery: string;
  open: (query?: string) => void;
  close: () => void;
  toggle: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteStore>((set, get) => ({
  isOpen: false,
  initialQuery: "",

  open: (query = "") => set({ isOpen: true, initialQuery: query }),
  close: () => set({ isOpen: false, initialQuery: "" }),
  toggle: () => (get().isOpen ? get().close() : get().open()),
}));