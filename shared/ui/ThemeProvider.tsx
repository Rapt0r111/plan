/**
 * @file ThemeProvider.tsx — shared/ui
 *
 * Монтируется ОДИН РАЗ в app/layout.tsx.
 * При монтировании читает реальную тему (localStorage / prefers-color-scheme)
 * и применяет класс к <html>. Устраняет FOUC на клиенте.
 *
 * Для устранения FOUC на сервере — инлайн-скрипт в layout.tsx (см. ниже).
 */
"use client";
import { useEffect } from "react";
import { useThemeStore } from "@/shared/store/useThemeStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    // Читаем реальное значение при гидрации
    let theme: "dark" | "light" = "dark";
    try {
      const stored = localStorage.getItem("theme") as "dark" | "light" | null;
      if (stored === "dark" || stored === "light") {
        theme = stored;
      } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
        theme = "light";
      }
    } catch {}
    setTheme(theme);
  }, [setTheme]);

  return <>{children}</>;
}