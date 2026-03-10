/**
 * @file BoardPage.tsx — app/(main)/board/BoardPage.tsx
 *
 * ОПТИМИЗАЦИЯ v2:
 *  TaskSlideover — тяжёлый компонент с framer-motion анимациями и SubtaskList.
 *  Загружается только когда пользователь кликает на задачу, а не при монтировании.
 *
 * NEW IN v3:
 *  • useBoardKeyNav — vim-style J/K/Enter/Escape/E keyboard navigation.
 *  • KeyboardHint strip — non-intrusive shortcut reminder in the footer area.
 *    Fades out after 8 seconds on first load (localStorage flag persists dismissal).
 *
 * THEME v4:
 *  • Hardcoded rgba(8,9,15,…) → var(--filter-bar-bg)
 *  • Modal glass bg → var(--modal-bg)
 */
"use client";
import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { SmartFilters, EMPTY_FILTERS, applyFilters } from "@/features/filters/SmartFilters";
import { EpicColumn } from "@/widgets/board/EpicColumn";
import { useBoardKeyNav } from "@/features/board/useBoardKeyNav";
import type { FilterState } from "@/features/filters/SmartFilters";
import type { TaskView } from "@/shared/types";

const TaskSlideover = dynamic(
    () => import("@/features/task-details/TaskSlideover").then((m) => ({ default: m.TaskSlideover })),
    { ssr: false },
);

// ── Animation variants ────────────────────────────────────────────────────────

const containerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.07, delayChildren: 0.1 },
    },
};

const columnVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1, y: 0,
        transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
    exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2 } },
};

// ── Keyboard hint strip ───────────────────────────────────────────────────────

function KbdHint({ children }: { children: React.ReactNode }) {
    return (
        <kbd
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{
                background: "var(--glass-02)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-muted)",
            }}
        >
            {children}
        </kbd>
    );
}

const HINT_STORAGE_KEY = "board_keynav_hint_dismissed";

function KeyboardHint() {
    const [visible, setVisible] = useState(() => {
        if (typeof window === "undefined") return false;

        try {
            const dismissed = localStorage.getItem(HINT_STORAGE_KEY);
            return !dismissed;
        } catch {
            return true;
        }
    });

    useEffect(() => {
        if (!visible) return;

        const timer = setTimeout(() => setVisible(false), 8000);
        return () => clearTimeout(timer);
    }, [visible]);

    function dismiss() {
        setVisible(false);
        try {
            localStorage.setItem(HINT_STORAGE_KEY, "1");
        } catch {
            /* ignore */
        }
    }

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8, transition: { duration: 0.25 } }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                    style={{
                        background: "var(--modal-bg)",
                        border: "1px solid var(--glass-border)",
                        backdropFilter: "blur(16px)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(139,92,246,0.12)",
                        pointerEvents: "auto",
                    }}
                >
                    {/* Shortcuts */}
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        <div className="flex items-center gap-1">
                            <KbdHint>J</KbdHint>
                            <KbdHint>K</KbdHint>
                            <span className="ml-1">навигация</span>
                        </div>
                        <span className="opacity-30">·</span>
                        <div className="flex items-center gap-1">
                            <KbdHint>↵</KbdHint>
                            <span className="ml-1">открыть</span>
                        </div>
                        <span className="opacity-30">·</span>
                        <div className="flex items-center gap-1">
                            <KbdHint>E</KbdHint>
                            <span className="ml-1">статус</span>
                        </div>
                        <span className="opacity-30">·</span>
                        <div className="flex items-center gap-1">
                            <KbdHint>Esc</KbdHint>
                            <span className="ml-1">сбросить</span>
                        </div>
                    </div>

                    {/* Dismiss */}
                    <button
                        onClick={dismiss}
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center ml-1 transition-opacity hover:opacity-70"
                        style={{ background: "var(--glass-02)", color: "var(--text-muted)" }}
                    >
                        <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"
                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M2 2l6 6M8 2L2 8" />
                        </svg>
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BoardPage() {
    const epics = useTaskStore((s) => s.epics);
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
    const [activeTask, setActiveTask] = useState<TaskView | null>(null);

    const visibleEpics = useMemo(() => {
        if (!filters.roleKeys.length && !filters.statuses.length && !filters.priorities.length) {
            return epics;
        }
        return epics.filter((e) => applyFilters(e.tasks, filters).length > 0);
    }, [epics, filters]);

    // ── Keyboard navigation ─────────────────────────────────────────────────
    const { focusedTaskId, setFocusedTaskId } = useBoardKeyNav({
        visibleEpics,
        onOpenTask: setActiveTask,
    });

    const hasActiveFilters =
        filters.roleKeys.length > 0 || filters.statuses.length > 0 || filters.priorities.length > 0;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ── Filter bar ──────────────────────────────────────────────────── */}
            <div
                className="shrink-0 px-6 py-3 border-b"
                style={{
                    background: "var(--filter-bar-bg)",
                    backdropFilter: "blur(16px)",
                    borderColor: "var(--glass-border)",
                }}
            >
                <SmartFilters filters={filters} onChange={setFilters} />
            </div>

            {/* ── Board ───────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-x-auto overflow-y-auto">
                <div className="p-6 min-h-full">
                    {/* Empty state */}
                    <AnimatePresence>
                        {hasActiveFilters && visibleEpics.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-24 text-center"
                            >
                                <div
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border"
                                    style={{
                                        background: "var(--glass-02)",
                                        borderColor: "var(--glass-border)",
                                    }}
                                >
                                    <svg
                                        className="w-6 h-6 text-(--text-muted)"
                                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                                    >
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.35-4.35" />
                                    </svg>
                                </div>
                                <p className="text-sm font-medium text-[var(--text-secondary)]">
                                    Ничего не найдено
                                </p>
                                <p className="text-xs text-(--text-muted) mt-1">
                                    Попробуйте изменить фильтры
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Epic columns */}
                    <motion.div
                        variants={containerVariants} initial="hidden" animate="visible"
                        className="grid gap-5"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))" }}
                    >
                        <AnimatePresence mode="popLayout">
                            {visibleEpics.map((epic) => (
                                <motion.div key={epic.id} variants={columnVariants} exit="exit" layout>
                                    <EpicColumn
                                        epic={epic}
                                        filters={filters}
                                        onOpenTask={(task) => {
                                            setFocusedTaskId(task.id);
                                            setActiveTask(task);
                                        }}
                                        focusedTaskId={focusedTaskId}
                                        onFocusTask={setFocusedTaskId}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>

            {/* ── Slideover ───────────────────────────────────────────────────── */}
            {activeTask && (
                <TaskSlideover task={activeTask} onClose={() => setActiveTask(null)} />
            )}

            {/* ── Keyboard shortcut hint ───────────────────────────────────────── */}
            <KeyboardHint />
        </div>
    );
}