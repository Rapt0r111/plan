/**
 * @file useThemeStore.ts — shared/store
 *
 * Thin Zustand slice для управления темой.
 *
 * ПРИОРИТЕТ при инициализации:
 *  1. localStorage ("theme" ключ) — явный выбор пользователя
 *  2. prefers-color-scheme — системная настройка
 *  3. "dark" — fallback (сохраняем поведение по умолчанию)
 */
"use client";
import { create } from "zustand";

export type Theme = "dark" | "light";

interface ThemeStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: "dark", // SSR default; реальное значение устанавливается в ThemeProvider

  setTheme: (theme) => {
    set({ theme });
    try {
      localStorage.setItem("theme", theme);
    } catch {}
    // Обновляем класс на <html>
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(theme);
  },

  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));