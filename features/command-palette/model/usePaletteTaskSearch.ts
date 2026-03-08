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
 * CONTEXTUAL GROUPS (query < 2 chars):
 *  Instead of an empty state, show smart buckets:
 *   • Просрочено  — dueDate < now
 *   • Заблокировано — status === "blocked"
 *   • Без исполнителя — assignees.length === 0
 *
 * ACTION ON SELECT:
 *  Opens the TaskSlideover via useGlobalTaskStore — keeps the user
 *  in the current page context instead of navigating away.
 */
import { useMemo } from "react";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useCommandPaletteStore } from "../useCommandPaletteStore";
import { scoreTaskQuery } from "./fuzzy";
import type { CommandItem } from "./fuzzy";
import { useGlobalTaskStore } from "@/shared/store/useGlobalTaskStore";

// ── Visual config ─────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, string> = {
  todo: "○",
  in_progress: "◑",
  done: "●",
  blocked: "⊘",
};

const STATUS_COLOR: Record<string, string> = {
  todo: "#64748b",
  in_progress: "#38bdf8",
  done: "#34d399",
  blocked: "#f87171",
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "Критично",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

const MAX_RESULTS = 8;

// ── Hook ──────────────────────────────────────────────────────────────────────

const getCurrentTime = () => Date.now();

export function usePaletteTaskSearch(debouncedQuery: string): CommandItem[] {
  const tasks = useTaskStore((s) => s.tasks);
  const epics = useTaskStore((s) => s.epics);
  const { close } = useCommandPaletteStore();
  const now = useMemo(() => getCurrentTime(), []);
  return useMemo(() => {
    const q = debouncedQuery.trim();

    const epicMap = new Map(epics.map((e) => [e.id, e]));
    const allTasks = Object.values(tasks);

    // ── Contextual groups when no query ──────────────────────────────────
    if (q.length < 2) {


      const overdue = allTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== "done",
      );
      const blocked = allTasks.filter((t) => t.status === "blocked");
      const unassigned = allTasks.filter((t) => t.assignees.length === 0 && t.status !== "done");

      const buckets: Array<{ tasks: typeof allTasks; groupLabel: string; icon: string; color: string }> = [
        { tasks: overdue, groupLabel: "Просрочено", icon: "⏰", color: "#f87171" },
        { tasks: blocked, groupLabel: "Заблокировано", icon: "⊘", color: "#f87171" },
        { tasks: unassigned, groupLabel: "Без исполнителя", icon: "?", color: "#64748b" },
      ];

      return buckets.flatMap(({ tasks: bucket, groupLabel, icon, color }) =>
        bucket.slice(0, 3).map((task) => {
          const epic = epicMap.get(task.epicId);
          return {
            id: `ctx-${groupLabel}-${task.id}`,
            category: "task" as const,
            label: task.title,
            description: epic ? `${groupLabel} · ${epic.title}` : groupLabel,
            icon,
            color,
            keywords: [],
            onSelect: () => {
              useGlobalTaskStore.getState().openTask(task.id);
              close();
            },
          } satisfies CommandItem;
        }),
      );
    }

    // ── Full fuzzy search ─────────────────────────────────────────────────
    return allTasks
      .map((task) => ({
        task,
        score: scoreTaskQuery(q, task.title, task.description),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map(({ task, score }) => {
        const epic = epicMap.get(task.epicId);
        const statusIcon = STATUS_ICON[task.status] ?? "○";
        const statusColor = STATUS_COLOR[task.status] ?? "#64748b";

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
          color: statusColor,
          keywords: [],
          onSelect: () => {
            useGlobalTaskStore.getState().openTask(task.id);
            close();
          },
        } satisfies CommandItem;
      });
  }, [debouncedQuery, tasks, epics, close, now]);
}