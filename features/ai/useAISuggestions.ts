/**
 * @file useAISuggestions.ts — features/ai
 *
 * Эвристическая автокатегоризация приоритета по тексту задачи.
 * Никакого API — чистый regex, нулевая задержка.
 *
 * Использование: см. QuickAddTask.tsx → handleTitleChange
 */
import type { TaskPriority } from "@/shared/db/schema";

const CRITICAL_PATTERNS = /срочно|asap|блок|critical|сломан|не работает|prod|прод/i;
const HIGH_PATTERNS     = /важн|deadline|дедлайн|релиз|release|баг|bug/i;
const LOW_PATTERNS      = /рефактор|refactor|улучш|improve|nice to have|потом|later/i;

export function suggestPriority(title: string, description?: string | null): TaskPriority | null {
  const text = `${title} ${description ?? ""}`;
  if (CRITICAL_PATTERNS.test(text)) return "critical";
  if (HIGH_PATTERNS.test(text))     return "high";
  if (LOW_PATTERNS.test(text))      return "low";
  return null;
}