"use client";
/**
 * @file useBoardKeyNav.ts — features/board
 *
 * Vim-style keyboard navigation for the board.
 *
 * SHORTCUTS:
 *  J       — focus next task (down across all visible epics, flattened)
 *  K       — focus previous task
 *  Enter   — open focused task in Slideover
 *  Escape  — clear focus
 *  E       — cycle focused task's status (todo → in_progress → done → blocked → todo)
 *
 * DESIGN RATIONALE:
 *  Tasks are flattened from visibleEpics in their natural board order
 *  (epic order × status-section order × task order within section).
 *  This mirrors the visual top-to-bottom, left-to-right reading flow,
 *  so J/K feel spatial — not arbitrary.
 *
 *  The hook owns only focus state; Slideover open state lives in BoardPage.
 *  Decoupling lets each concern evolve independently.
 *
 * GUARD:
 *  Navigation is suppressed when the user is typing in an input/textarea
 *  to prevent accidental navigation while using SmartFilters or CommandPalette.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { EpicWithTasks, TaskView, TaskStatus } from "@/shared/types";

// Status cycle order for E shortcut
const STATUS_CYCLE: TaskStatus[] = ["todo", "in_progress", "done", "blocked"];

// The visual render order that matches EpicColumn STATUS_SECTIONS
const SECTION_ORDER: TaskStatus[] = ["in_progress", "todo", "blocked", "done"];

function isEditable(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
}

interface Options {
    visibleEpics: EpicWithTasks[];
    onOpenTask: (task: TaskView) => void;
}

interface UseBoardKeyNavReturn {
    focusedTaskId: number | null;
    setFocusedTaskId: (id: number | null) => void;
}

export function useBoardKeyNav({ visibleEpics, onOpenTask }: Options): UseBoardKeyNavReturn {
    const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
    const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
    const getTask = useTaskStore((s) => s.getTask);

    // Flatten all visible tasks preserving visual order (epic → section → task)
    const flatTasks = useMemo<TaskView[]>(() => {
        const result: TaskView[] = [];
        for (const epic of visibleEpics) {
            const byStatus: Record<TaskStatus, TaskView[]> = {
                in_progress: [], todo: [], blocked: [], done: [],
            };
            for (const t of epic.tasks) {
                byStatus[t.status]?.push(t);
            }
            for (const status of SECTION_ORDER) {
                const group = byStatus[status];
                // Skip empty non-core sections (same logic as EpicColumn)
                if (!group.length && status !== "in_progress" && status !== "todo") continue;
                result.push(...group);
            }
        }
        return result;
    }, [visibleEpics]);

    const focusedIndex = useMemo(
        () => flatTasks.findIndex((t) => t.id === focusedTaskId),
        [flatTasks, focusedTaskId],
    );

    const moveFocus = useCallback((delta: 1 | -1) => {
        if (flatTasks.length === 0) return;
        if (focusedIndex === -1) {
            // Nothing focused yet — start at beginning or end
            setFocusedTaskId(delta === 1 ? flatTasks[0].id : flatTasks[flatTasks.length - 1].id);
            return;
        }
        const next = (focusedIndex + delta + flatTasks.length) % flatTasks.length;
        setFocusedTaskId(flatTasks[next].id);
    }, [flatTasks, focusedIndex]);

    const cycleStatus = useCallback(() => {
        if (focusedTaskId == null) return;
        const live = getTask(focusedTaskId);
        if (!live) return;
        const idx = STATUS_CYCLE.indexOf(live.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        updateTaskStatus(focusedTaskId, next);
    }, [focusedTaskId, getTask, updateTaskStatus]);

    // Clear focus when the task list changes (e.g. filter applied)

    const safeFocusedTaskId =
        focusedTaskId !== null && flatTasks.some(t => t.id === focusedTaskId)
            ? focusedTaskId
            : null;
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            // Never fire inside inputs (SmartFilters, CommandPalette, etc.)
            if (isEditable()) return;
            // Never fire with modifier keys (let browser/OS shortcuts through)
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            switch (e.key) {
                case "j":
                case "J":
                    e.preventDefault();
                    moveFocus(1);
                    break;

                case "k":
                case "K":
                    e.preventDefault();
                    moveFocus(-1);
                    break;

                case "Enter":
                    if (focusedTaskId !== null) {
                        e.preventDefault();
                        const task = getTask(focusedTaskId);
                        if (task) onOpenTask(task);
                    }
                    break;

                case "Escape":
                    if (focusedTaskId !== null) {
                        e.preventDefault();
                        setFocusedTaskId(null);
                    }
                    break;

                case "e":
                case "E":
                    if (focusedTaskId !== null) {
                        e.preventDefault();
                        cycleStatus();
                    }
                    break;
            }
        }

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [moveFocus, focusedTaskId, getTask, onOpenTask, cycleStatus]);

    return { focusedTaskId: safeFocusedTaskId, setFocusedTaskId };
}