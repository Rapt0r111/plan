/**
 * @file utils.ts — shared/lib
 *
 * РЕФАКТОРИНГ v2:
 *   + formatDateInput() — ранее дублировалась в EpicsTab.tsx и TasksTab.tsx
 *   + formatDateDisplay() — то же самое
 *   + UserOption — ранее определялась отдельно в QuickAddTask.tsx,
 *     CreateTaskModal.tsx, TasksTab.tsx (3 идентичных определения)
 *
 * Единственный источник правды для утилит UI-форматирования.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ─── className ────────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * formatDate — короткий формат для карточек задач (напр. "15 янв")
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

/**
 * formatDateInput — возвращает ISO-дату в формате YYYY-MM-DD для input[type=date].
 * Ранее дублировалась в EpicsTab.tsx и TasksTab.tsx.
 *
 * @example formatDateInput("2025-03-15T00:00:00.000Z") → "2025-03-15"
 * @example formatDateInput(null) → ""
 */
export function formatDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/**
 * formatDateDisplay — человекочитаемый формат для отображения рядом с input[type=date].
 * С проверкой просрочки и «сегодня».
 *
 * @example formatDateDisplay("2025-03-15T00:00:00.000Z") → "15 мар 2025 г."
 * @example formatDateDisplay(null) → "—"
 */
export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const isOverdue = d < now && d.toDateString() !== now.toDateString();
  const isToday = d.toDateString() === now.toDateString();

  const str = d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (isOverdue) return `${str} ⚠`;
  if (isToday) return `${str} (сегодня)`;
  return str;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export function computeProgress(
  subtasks: { isCompleted: boolean }[],
): { done: number; total: number } {
  return {
    done: subtasks.filter((s) => s.isCompleted).length,
    total: subtasks.length,
  };
}

// ─── UserOption (shared type for forms) ──────────────────────────────────────

/**
 * UserOption — лёгкий тип пользователя для выпадающих списков и пикеров.
 * Ранее определялся отдельно в 3 файлах:
 *   - QuickAddTask.tsx
 *   - CreateTaskModal.tsx
 *   - TasksTab.tsx
 *
 * Не путать с UserWithMeta из @/shared/types — тот содержит полные данные из БД.
 * UserOption — только то, что нужно для UI-форм (меньше зависимостей).
 */
export interface UserOption {
  id: number;
  name: string;
  initials: string;
  roleMeta: {
    hex: string;
    label: string;
    short: string;
    key: string;
  };
}