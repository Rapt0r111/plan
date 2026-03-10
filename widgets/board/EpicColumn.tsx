"use client";
/**
 * @file EpicColumn.tsx — widgets/board
 *
 * Glass panel for one Epic in the board. Groups tasks by status.
 * Drop zones highlight with the epic's own color — spatial cohesion.
 * Stagger animation via Framer Motion for cascade reveal.
 *
 * NEW IN v2:
 *  • Accepts focusedTaskId + onFocusTask from BoardPage for keyboard nav.
 *  • Passes isFocused / onFocus through to each BoardTaskCard.
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { BoardTaskCard } from "./BoardTaskCard";
import { useBoardDnD } from "@/features/board/hooks/useBoardDnD";
import { applyFilters } from "@/features/filters/SmartFilters";
import type { FilterState } from "@/features/filters/SmartFilters";
import type { EpicWithTasks, TaskView, TaskStatus } from "@/shared/types";
import { QuickAddTask } from "./QuickAddTask";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";


const STATUS_SECTIONS: { key: TaskStatus; label: string }[] = [
  { key: "in_progress", label: "В работе" },
  { key: "todo", label: "К работе" },
  { key: "blocked", label: "Заблокировано" },
  { key: "done", label: "Готово" },
];

const STATUS_COLOR: Record<TaskStatus, string> = {
  in_progress: "#38bdf8",
  todo: "#64748b",
  blocked: "#f87171",
  done: "#34d399",
};

interface Props {
  epic: EpicWithTasks;
  filters: FilterState;
  defaultCollapsed?: boolean;
  onOpenTask?: (task: TaskView) => void;
  /** Id of the keyboard-focused task (from useBoardKeyNav) */
  focusedTaskId?: number | null;
  /** Called when the user clicks a card (updates keyboard focus) */
  onFocusTask?: (taskId: number) => void;
}

export function EpicColumn({
  epic,
  filters,
  defaultCollapsed = false,
  onOpenTask,
  focusedTaskId,
  onFocusTask,
}: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const { getDragProps, getDropProps } = useBoardDnD();

  const pct = epic.progress.total > 0
    ? Math.round((epic.progress.done / epic.progress.total) * 100)
    : 0;

  const filteredTasks = useMemo(
    () => applyFilters(epic.tasks, filters),
    [epic.tasks, filters],
  );

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, TaskView[]> = {
      in_progress: [], todo: [], blocked: [], done: [],
    };
    for (const t of filteredTasks) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [filteredTasks]);

  const isFiltered = filteredTasks.length !== epic.tasks.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderLeft: `3px solid ${epic.color}`,
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        className="px-4 py-3.5 flex items-center gap-3 cursor-pointer select-none"
        style={{
          background: `linear-gradient(135deg, ${epic.color}14 0%, transparent 60%)`,
          borderBottom: "1px solid var(--glass-border)",
        }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: epic.color, boxShadow: `0 0 8px ${epic.color}90` }}
        />

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {epic.title}
          </h2>
          {epic.description && (
            <p className="text-xs text-(--text-muted) truncate mt-0.5">
              {epic.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isFiltered ? (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[rgba(139,92,246,0.15)] text-[var(--accent-400)] border border-[rgba(139,92,246,0.25)]">
              {filteredTasks.length}/{epic.tasks.length}
            </span>
          ) : (
            <AnimatedCounter value={epic.tasks.length} className="text-xs font-mono text-(--text-muted)" />

          )}

          <span
            className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${epic.color}22`, color: epic.color }}
          >
            {pct}%
          </span>

          <motion.svg
            className="w-4 h-4 text-(--text-muted)"
            viewBox="0 0 16 16" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round"
            animate={{ rotate: collapsed ? -90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path d="M4 6l4 4 4-4" />
          </motion.svg>
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className="h-0.5 bg-[var(--glass-02)]">
        <motion.div
          className="h-full relative overflow-hidden"
          style={{ backgroundColor: epic.color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
        >
          {/* Shimmer при pct === 100 */}
          {pct === 100 && (
            <motion.div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
              }}
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.2, repeat: 3, ease: "easeInOut" }}
            />
          )}
        </motion.div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-4">
              {STATUS_SECTIONS.map(({ key, label }) => {
                const tasks = grouped[key];
                const isActive = key === "in_progress" || key === "todo";
                if (!isActive && !tasks.length) return null;

                const dropProps = getDropProps(key);
                const isDropActive = dropProps["data-drop-active"];

                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: STATUS_COLOR[key] }}
                      />
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {label}
                      </span>
                      <span className="text-xs font-mono text-(--text-muted)">
                        {tasks.length}
                      </span>
                    </div>

                    <div
                      {...dropProps}
                      className={cn(
                        "min-h-10 rounded-xl p-1 space-y-2 transition-all duration-200",
                        isDropActive && "ring-1 ring-[var(--accent-500)]",
                      )}
                      style={
                        isDropActive
                          ? {
                            backgroundColor: `${epic.color}10`,
                            boxShadow: `0 0 0 1px ${epic.color}40 inset`,
                          }
                          : undefined
                      }
                    >
                      {tasks.length === 0 ? (
                        <div
                          className={cn(
                            "flex flex-col items-center justify-center gap-2 min-h-10 rounded-lg text-xs text-(--text-muted)",
                            "border border-dashed border-[var(--glass-border)] transition-colors px-1 py-2",
                            isDropActive && "border-[var(--accent-500)] text-[var(--accent-400)]",
                          )}
                        >
                          <span>{isDropActive ? "Отпустите здесь" : "Нет задач"}</span>
                          {(key === "todo" || key === "in_progress") && (
                            <QuickAddTask
                              epicId={epic.id}
                              defaultStatus={key}
                              epicColor={epic.color}
                            />
                          )}
                        </div>
                      ) : (
                        <motion.div layout className="space-y-2">
                          {tasks.map((task, idx) => (
                            <motion.div
                              key={task.id} layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{
                                opacity: 0,
                                scale: 0.88,
                                y: 12,
                                rotate: Math.random() > 0.5 ? 3 : -3,
                                filter: "blur(2px)",
                                transition: { duration: 0.25, ease: [0.4, 0, 1, 1] },
                              }}
                              transition={{ duration: 0.18, delay: idx * 0.04 }}
                            >
                              <BoardTaskCard
                                task={task}
                                dragProps={getDragProps(task.id)}
                                onOpen={onOpenTask}
                                isFocused={focusedTaskId === task.id}
                                onFocus={onFocusTask}
                              />
                            </motion.div>
                          ))}
                          {(key === "todo" || key === "in_progress") && (
                            <div className="mt-2">
                              <QuickAddTask
                                epicId={epic.id}
                                defaultStatus={key}
                                epicColor={epic.color}
                              />
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>

                  </div>

                );

              })}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}