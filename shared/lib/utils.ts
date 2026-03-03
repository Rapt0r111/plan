/**
 * @file utils.ts - shared/lib
 * Lean utility belt. No business logic — keep it that way.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export function computeProgress(subtasks: { isCompleted: boolean }[]): { done: number; total: number } {
  return {
    done: subtasks.filter((s) => s.isCompleted).length,
    total: subtasks.length,
  };
}
