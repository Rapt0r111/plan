"use client";
/**
 * @file usePaletteTaskSearch.ts — features/command-palette/model
 *
 * Returns up to 8 task CommandItems matching the debounced query.
 *
 * ARCHITECTURE NOTE:
 *  Kept separate from usePaletteCommands so task search can be
 *  triggered only when a non-empty query is present — avoids
 *  flooding the palette with hundreds of task items on open.
 *
 * ACTION ON SELECT:
 *  Navigates to the epic detail page where the task lives.
 *  The EpicDetailClient renders all tasks and the TaskSlideover,
 *  so the user lands in the right context immediately.
 */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useCommandPaletteStore } from "../useCommandPaletteStore";
import { scoreTaskQuery } from "./fuzzy";
import type { CommandItem } from "./fuzzy";

// Status icon + colour for visual scanning in results
const STATUS_ICON: Record<string, string> = {
  todo:        "○",
  in_progress: "◑",
  done:        "●",
  blocked:     "⊘",
};

const STATUS_COLOR: Record<string, string> = {
  todo:        "#64748b",
  in_progress: "#38bdf8",
  done:        "#34d399",
  blocked:     "#f87171",
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "Критично",
  high:     "Высокий",
  medium:   "Средний",
  low:      "Низкий",
};

const MAX_RESULTS = 8;

export function usePaletteTaskSearch(debouncedQuery: string): CommandItem[] {
  const tasks  = useTaskStore((s) => s.tasks);
  const epics  = useTaskStore((s) => s.epics);
  const router = useRouter();
  const { close } = useCommandPaletteStore();

  return useMemo(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) return [];

    // Build epic lookup once
    const epicMap = new Map(epics.map((e) => [e.id, e]));

    return Object.values(tasks)
      .map((task) => ({
        task,
        score: scoreTaskQuery(q, task.title, task.description),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map(({ task, score }) => {
        const epic       = epicMap.get(task.epicId);
        const statusIcon = STATUS_ICON[task.status] ?? "○";
        const statusColor = STATUS_COLOR[task.status] ?? "#64748b";

        // Description line: epic title + priority badge
        const priorityPart = PRIORITY_LABEL[task.priority]
          ? ` · ${PRIORITY_LABEL[task.priority]}`
          : "";
        const description = epic
          ? `${epic.title}${priorityPart}`
          : `Эпик #${task.epicId}${priorityPart}`;

        return {
          id: `task-search-${task.id}-${score}`,
          category: "task" as const,
          label: task.title,
          description,
          icon: statusIcon,
          // Inherit epic colour for the icon background tint
          color: statusColor,
          keywords: [],
          onSelect: () => {
            router.push(`/epics/${task.epicId}`);
            close();
          },
        } satisfies CommandItem;
      });
  }, [debouncedQuery, tasks, epics, router, close]);
}