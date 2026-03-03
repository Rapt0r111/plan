"use client";
// BoardTaskCard.tsx - widgets/board
// Dark task card with DnD support and Zustand optimistic updates.
import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { RoleBadge } from "@/features/role-badge/RoleBadge";
import { formatDate } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { TaskView, TaskStatus } from "@/shared/types";

const STATUS_CFG: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  todo: { label: "К работе", bg: "rgba(100,116,139,0.18)", text: "#94a3b8" },
  in_progress: { label: "В работе", bg: "rgba(14,165,233,0.18)", text: "#38bdf8" },
  done: { label: "Готово", bg: "rgba(16,185,129,0.18)", text: "#34d399" },
  blocked: { label: "Заблокировано", bg: "rgba(239,68,68,0.18)", text: "#f87171" },
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#475569",
};

interface DragProps {
  draggable: true;
  "data-dragging": boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export function BoardTaskCard({ task, dragProps, onOpen, }: { task: TaskView; dragProps: DragProps, onOpen?: (task: TaskView) => void; }) {
  const [expanded, setExpanded] = useState(false);
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
  const liveTask = useTaskStore((s) => s.getTask(task.id)) ?? task;
  const { label, bg, text } = STATUS_CFG[liveTask.status];
  const isDragging = dragProps["data-dragging"];

  function cycleStatus() {
    const order: TaskStatus[] = ["todo", "in_progress", "done"];
    const next = order[(order.indexOf(liveTask.status as TaskStatus) + 1) % order.length];
    updateTaskStatus(liveTask.id, next);
  }

  return (
    <div
      {...dragProps}
      data-priority={liveTask.priority}
      onClick={() => onOpen?.(liveTask)}
      className={cn(
        "rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-200 select-none",
        isDragging
          ? "opacity-40 scale-[0.98] ring-1 ring-[var(--accent-500)]"
          : "hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)]"
      )}
      style={{ background: "var(--bg-overlay)", border: "1px solid var(--glass-border)" }}
    >
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); cycleStatus(); }}
          className="mt-0.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 hover:opacity-80 transition-opacity"
          style={{ backgroundColor: bg, color: text }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_DOT[liveTask.priority] }} />
          {label}
        </button>

        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-medium leading-snug",
            liveTask.status === "done" ? "line-through text-(--text-muted)" : "text-[var(--text-primary)]"
          )}>
            {liveTask.title}
          </p>
          {liveTask.description && (
            <p className="text-xs text-(--text-muted) mt-0.5 line-clamp-1">{liveTask.description}</p>
          )}
          <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
            {liveTask.assignees.slice(0, 2).map((a) => (
              <RoleBadge key={a.id} roleMeta={a.roleMeta} size="sm" showLabel={false} />
            ))}
            {liveTask.assignees.length > 0 && (
              <span className="text-xs text-(--text-muted) truncate">
                {liveTask.assignees[0].roleMeta.label}
                {liveTask.assignees.length > 1 && ` +${liveTask.assignees.length - 1}`}
              </span>
            )}
            {liveTask.dueDate && (
              <span className="ml-auto text-xs font-mono text-(--text-muted)">{formatDate(liveTask.dueDate)}</span>
            )}
          </div>
        </div>

        {liveTask.subtasks.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="shrink-0 flex items-center gap-1 text-xs text-(--text-muted) hover:text-[var(--text-secondary)] transition-colors"
          >
            <span className="font-mono">{liveTask.progress.done}/{liveTask.progress.total}</span>
            <svg className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")}
              viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>
        )}
      </div>

      {liveTask.subtasks.length > 0 && (
        <div className="mx-3 mb-1 h-0.5 bg-[var(--glass-02)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--accent-500)] transition-all duration-300"
            style={{ width: `${(liveTask.progress.done / liveTask.progress.total) * 100}%` }} />
        </div>
      )}

      {expanded && (
        <div className="border-t border-[var(--glass-border)] px-3 py-2 space-y-1" onClick={(e) => e.stopPropagation()}>
          {liveTask.subtasks.map((st) => (
            <label key={st.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
              <input type="checkbox" checked={st.isCompleted}
                onChange={() => toggleSubtask(liveTask.id, st.id, st.isCompleted)}
                className="w-3 h-3 rounded accent-indigo-500" />
              <span className={cn("text-xs", st.isCompleted ? "line-through text-(--text-muted)" : "text-[var(--text-secondary)]")}>
                {st.title}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}