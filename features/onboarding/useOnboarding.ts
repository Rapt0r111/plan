// НОВЫЙ ФАЙЛ: features/onboarding/useOnboarding.ts
"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingStore {
  completed: boolean;
  step: number;
  hints: {
    boardKeyNav: boolean;
    commandPalette: boolean;
    zenMode: boolean;
    quickAdd: boolean;
  };
  dismissHint: (key: keyof OnboardingStore["hints"]) => void;
  complete: () => void;
}

export const useOnboarding = create<OnboardingStore>()(
  persist(
    (set) => ({
      completed: false,
      step: 0,
      hints: {
        boardKeyNav: true,
        commandPalette: true,
        zenMode: true,
        quickAdd: true,
      },
      dismissHint: (key) =>
        set((s) => ({ hints: { ...s.hints, [key]: false } })),
      complete: () => set({ completed: true }),
    }),
    { name: "plan-onboarding" }
  )
);