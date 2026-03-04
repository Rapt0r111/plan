/**
 * @file task-meta.ts — shared/config
 *
 * Single Source of Truth для визуальных метаданных статусов и приоритетов задач.
 *
 * ПРОБЛЕМА ДО РЕФАКТОРИНГА:
 *  STATUS_CFG и PRIORITY_COLOR были скопированы в 7 файлах:
 *  BoardTaskCard, DarkTaskCard, EpicDetailClient, TaskSlideover,
 *  InfiniteTimeline, SmartFilters, ZenMode.
 *  Любое изменение цвета требовало правок в 7 местах.
 *
 * ПОСЛЕ:
 *  Один источник. Импортируй { STATUS_META, PRIORITY_META } там, где нужно.
 */

import type { TaskStatus, TaskPriority } from "@/shared/types";

// ─── Status ───────────────────────────────────────────────────────────────────

export interface StatusMeta {
  label: string;
  /** Полупрозрачный фон для пилюль */
  bg: string;
  /** Цвет текста */
  color: string;
  /** Solid-цвет для dot-индикаторов и прогресс-баров */
  solid: string;
  /** Полупрозрачная обводка */
  border: string;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo: {
    label:  "К работе",
    bg:     "rgba(100,116,139,0.18)",
    color:  "#94a3b8",
    solid:  "#64748b",
    border: "rgba(100,116,139,0.30)",
  },
  in_progress: {
    label:  "В работе",
    bg:     "rgba(14,165,233,0.18)",
    color:  "#38bdf8",
    solid:  "#0ea5e9",
    border: "rgba(14,165,233,0.30)",
  },
  done: {
    label:  "Готово",
    bg:     "rgba(16,185,129,0.18)",
    color:  "#34d399",
    solid:  "#10b981",
    border: "rgba(16,185,129,0.30)",
  },
  blocked: {
    label:  "Заблокировано",
    bg:     "rgba(239,68,68,0.18)",
    color:  "#f87171",
    solid:  "#ef4444",
    border: "rgba(239,68,68,0.30)",
  },
} as const;

/** Порядок статусов по умолчанию для рендера секций */
export const STATUS_ORDER: TaskStatus[] = ["in_progress", "todo", "blocked", "done"];

/** Порядок для цикличного переключения через клик */
export const STATUS_CYCLE: TaskStatus[] = ["todo", "in_progress", "done"];

// ─── Priority ─────────────────────────────────────────────────────────────────

export interface PriorityMeta {
  label: string;
  /** Основной HEX-цвет для dot, левого бордера и глоу */
  color: string;
  /** Полупрозрачный фон */
  bg: string;
  /** Полупрозрачная обводка */
  border: string;
}

export const PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
  critical: {
    label:  "Критично",
    color:  "#ef4444",
    bg:     "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.30)",
  },
  high: {
    label:  "Высокий",
    color:  "#f97316",
    bg:     "rgba(249,115,22,0.15)",
    border: "rgba(249,115,22,0.30)",
  },
  medium: {
    label:  "Средний",
    color:  "#eab308",
    bg:     "rgba(234,179,8,0.15)",
    border: "rgba(234,179,8,0.30)",
  },
  low: {
    label:  "Низкий",
    color:  "#475569",
    bg:     "rgba(71,85,105,0.15)",
    border: "rgba(71,85,105,0.30)",
  },
} as const;

export const PRIORITY_ORDER: TaskPriority[] = ["critical", "high", "medium", "low"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * cycleStatus — получить следующий статус в цикле клика.
 * @example cycleStatus("todo") // → "in_progress"
 */
export function cycleStatus(current: TaskStatus): TaskStatus {
  const idx = STATUS_CYCLE.indexOf(current);
  // Если статус не в цикле (blocked), возвращаем in_progress
  if (idx === -1) return "in_progress";
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}