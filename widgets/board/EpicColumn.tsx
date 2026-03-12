"use client";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { applyFilters, type FilterState } from "@/features/filters/SmartFilters";
import { useBoardDnD } from "@/features/board/hooks/useBoardDnD";
import { TaskCard } from "@/entities/task/ui/TaskCard";
import { QuickAddTask } from "./QuickAddTask";
import { STATUS_META, STATUS_ORDER } from "@/shared/config/task-meta";
import type { EpicWithTasks, TaskView, TaskStatus } from "@/shared/types";

export interface EpicColumnProps {
  epic: EpicWithTasks;
  filters: FilterState;
  onOpenTask: (task: TaskView) => void;
  focusedTaskId: number | null;
  onFocusTask: (id: number | null) => void;
}

export function EpicColumn({
  epic,
  filters,
  onOpenTask,
  focusedTaskId,
}: EpicColumnProps) {
  const { getDragProps, getDropProps, dragState } = useBoardDnD();

  const visibleTasks = useMemo(
    () => applyFilters(epic.tasks, filters),
    [epic.tasks, filters],
  );

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskView[]> = {
      in_progress: [], todo: [], blocked: [], done: [],
    };
    for (const t of visibleTasks) {
      map[t.status]?.push(t);
    }
    return map;
  }, [visibleTasks]);

  const pct =
    epic.progress.total > 0
      ? Math.round((epic.progress.done / epic.progress.total) * 100)
      : 0;

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderLeft: `3px solid ${epic.color}`,
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              backgroundColor: epic.color,
              boxShadow: `0 0 8px ${epic.color}60`,
            }}
          />
          <span
            className="text-sm font-semibold flex-1 truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {epic.title}
          </span>
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded-md shrink-0"
            style={{
              background: `${epic.color}18`,
              color: epic.color,
              border: `1px solid ${epic.color}30`,
            }}
          >
            {visibleTasks.length}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-0.5 rounded-full overflow-hidden"
          style={{ background: "var(--glass-02)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              backgroundColor: epic.color,
              boxShadow: `0 0 6px ${epic.color}60`,
            }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[80px]">
        {STATUS_ORDER.map((status) => {
          const tasks = byStatus[status];
          if (!tasks.length && status === "blocked") return null;
          const meta = STATUS_META[status];
          const isDropActive =
            dragState.overStatus === status && dragState.draggingId !== null;

          return (
            <div key={status}>
              {/* Section label */}
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: meta.solid }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
                <span
                  className="text-xs font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  {tasks.length}
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: "var(--glass-border)" }}
                />
              </div>

              {/* Drop zone */}
              <div
                className="space-y-1.5 min-h-[28px] rounded-xl p-1 transition-colors duration-150"
                style={{
                  background: isDropActive
                    ? "rgba(139,92,246,0.06)"
                    : "transparent",
                  border: isDropActive
                    ? "1px solid rgba(139,92,246,0.25)"
                    : "1px solid transparent",
                }}
                {...getDropProps(status)}
              >
                <AnimatePresence mode="popLayout">
                  {tasks.map((task) => {
                    const dragProps = getDragProps(task.id);
                    return (
                      // plain <div> owns the HTML drag API → no Framer Motion type conflict
                      <div
                        key={task.id}
                        draggable
                        data-dragging={dragProps["data-dragging"]}
                        onDragStart={dragProps.onDragStart}   // React.DragEvent ✓
                        onDragEnd={dragProps.onDragEnd}
                      >
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className={
                            focusedTaskId === task.id
                              ? "ring-1 ring-[var(--accent-400)] ring-opacity-60 rounded-xl"
                              : ""
                          }
                        >
                          <TaskCard task={task} onOpen={onOpenTask} />
                        </motion.div>
                      </div>
                    );
                  })}
                </AnimatePresence>

                {!tasks.length && (
                  <p
                    className="text-center py-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Нет задач
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <QuickAddTask epicId={epic.id} epicColor={epic.color} />
      </div>
    </div>
  );
}