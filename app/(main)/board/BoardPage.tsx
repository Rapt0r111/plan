"use client";
/**
 * @file BoardPage.tsx — app/(main)/board/BoardPage.tsx
 *
 * The Spatial Canvas — the main board view.
 *
 * Layout strategy: masonry-like responsive grid of EpicColumn panels.
 * Each column is self-contained with its own status grouping + DnD drop zones.
 * Filters are applied per-column via applyFilters() (pure, memoized).
 *
 * Cascade reveal: columns stagger in with Framer Motion on mount.
 * Filter transitions: AnimatePresence wraps the column grid so when filters
 * hide/show columns, they animate out/in gracefully.
 *
 * Performance: useTaskStore selects only epics array — re-renders only when
 * epic data changes, not on every subtask toggle.
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { SmartFilters, EMPTY_FILTERS, applyFilters } from "@/features/filters/SmartFilters";
import { EpicColumn } from "@/widgets/board/EpicColumn";
import type { FilterState } from "@/features/filters/SmartFilters";

const containerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.07, delayChildren: 0.1 },
    },
};

const columnVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
        }
    },
    exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2 } },
};

export function BoardPage() {
    const epics = useTaskStore((s) => s.epics);
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

    // Filter epics: show column if it has matching tasks OR filters are empty
    const visibleEpics = useMemo(() => {
        if (!filters.roles.length && !filters.statuses.length && !filters.priorities.length) {
            return epics;
        }
        return epics.filter((e) => applyFilters(e.tasks, filters).length > 0);
    }, [epics, filters]);

    const hasActiveFilters =
        filters.roles.length > 0 || filters.statuses.length > 0 || filters.priorities.length > 0;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ── Filter bar ─────────────────────────────────────────────────── */}
            <div
                className="shrink-0 px-6 py-3 border-b"
                style={{
                    background: "rgba(8,9,15,0.7)",
                    backdropFilter: "blur(16px)",
                    borderColor: "var(--glass-border)",
                }}
            >
                <SmartFilters filters={filters} onChange={setFilters} />
            </div>

            {/* ── Board canvas ───────────────────────────────────────────────── */}
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
                                <div className="w-12 h-12 rounded-2xl bg-[var(--glass-02)] flex items-center justify-center mb-4 border border-[var(--glass-border)]">
                                    <svg className="w-6 h-6 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                                    </svg>
                                </div>
                                <p className="text-sm font-medium text-[var(--text-secondary)]">Ничего не найдено</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Попробуйте изменить фильтры</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Column grid */}
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid gap-5"
                        style={{
                            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))",
                        }}
                    >
                        <AnimatePresence mode="popLayout">
                            {visibleEpics.map((epic) => (
                                <motion.div
                                    key={epic.id}
                                    variants={columnVariants}
                                    exit="exit"
                                    layout
                                >
                                    <EpicColumn epic={epic} filters={filters} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}