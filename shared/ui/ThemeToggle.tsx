/**
 * @file ThemeToggle.tsx — shared/ui
 *
 * Animated sun/moon toggle button.
 * Использует Framer Motion для плавной смены иконки.
 * Размещается в Header рядом с CommandPaletteTrigger.
 */
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "@/shared/store/useThemeStore";
import { cn } from "@/shared/lib/utils";

interface Props {
  className?: string;
}

export function ThemeToggle({ className }: Props) {
  const { theme, toggle } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <motion.button
      onClick={toggle}
      className={cn(
        "relative w-8 h-8 rounded-xl flex items-center justify-center",
        "transition-all duration-200",
        className
      )}
      style={{
        background: "var(--glass-02)",
        border: "1px solid var(--glass-border)",
        color: "var(--text-muted)",
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      aria-label="Переключение темы"
    >
      <AnimatePresence mode="wait">
        {isDark ? (
          // Moon icon
          <motion.svg
            key="moon"
            initial={{ rotate: -30, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 30, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-4 h-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" />
          </motion.svg>
        ) : (
          // Sun icon
          <motion.svg
            key="sun"
            initial={{ rotate: 30, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -30, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-4 h-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}