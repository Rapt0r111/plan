/**
 * @file tailwind.config.ts
 *
 * ИСПРАВЛЕНИЕ: Tailwind 4 — CSS-first конфигурация.
 *   БЫЛО: theme.extend.fontFamily дублировал --font-sans / --font-mono
 *         из @theme блока в globals.css — два источника истины.
 *         В Tailwind 4 @theme в CSS имеет приоритет, но дубль создаёт
 *         путаницу и может вызвать неожиданное поведение при обновлениях.
 *
 *   СТАЛО: только content — сканирование файлов для purge.
 *         Все токены (шрифты, радиусы, цвета) живут в globals.css @theme.
 *         plugins: [] тоже убран — пустой массив не нужен явно.
 */
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./widgets/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./entities/**/*.{ts,tsx}",
    "./shared/**/*.{ts,tsx}",
  ],
} satisfies Config;