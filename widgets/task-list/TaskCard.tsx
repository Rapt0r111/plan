"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskView } from "@/shared/types";
import { RoleBadge } from "@/features/role-badge/RoleBadge";
import { formatDate } from "@/shared/lib/utils";

const STATUS_CONFIG = {
  todo:        { label: "К работе",  cls: "bg-slate-100 text-slate-600" },
  in_progress: { label: "В работе",  cls: "bg-sky-100 text-sky-700" },
  done:        { label: "Готово",    cls: "bg-emerald-100 text-emerald-700" },
  blocked:     { label: "Заблокировано", cls: "bg-red-100 text-red-600" },
} as const;

const PRIORITY_DOT = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-slate-300",
} as const;

interface Props {
  task: TaskView;
}

export function TaskCard({ task }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState(task.status);

  const { label, cls } = STATUS_CONFIG[optimisticStatus];

  async function cycleStatus() {
    const order = ["todo", "in_progress", "done"] as const;
    const next = order[(order.indexOf(optimisticStatus as typeof order[number]) + 1) % order.length];
    setOptimisticStatus(next);
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    startTransition(() => router.refresh());
  }

  async function toggleSubtask(subtaskId: number, current: boolean) {
    await fetch(`/api/subtasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: !current }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div
      data-priority={task.priority}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow"
    >
      {/* Main row */}
      <div className="px-4 py-3.5 flex items-start gap-3">
        {/* Status button */}
        <button
          onClick={cycleStatus}
          title="Изменить статус"
          className={`mt-0.5 status-pill cursor-pointer hover:opacity-80 transition-opacity shrink-0 ${cls}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`}
          />
          {label}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium leading-snug ${
              optimisticStatus === "done" ? "line-through text-slate-400" : "text-slate-900"
            }`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-2 mt-2">
            {/* Assignees */}
            <div className="flex items-center gap-1">
              {task.assignees.map((a) => (
                <RoleBadge key={a.id} roleMeta={a.roleMeta} size="sm" showLabel={false} />
              ))}
              {task.assignees.length > 0 && (
                <span className="text-xs text-slate-400">
                  {task.assignees.map((a) => a.roleMeta.label).join(", ")}
                </span>
              )}
            </div>

            {/* Due date */}
            {task.dueDate && (
              <span className="text-xs text-slate-400 font-mono ml-auto">
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle (if has subtasks) */}
        {task.subtasks.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="font-mono">
              {task.progress.done}/{task.progress.total}
            </span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Subtask progress bar */}
      {task.subtasks.length > 0 && (
        <div className="px-4 pb-1">
          <div className="h-0.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-400 rounded-full transition-all"
              style={{ width: `${(task.progress.done / task.progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtask checklist (collapsible) */}
      {expanded && task.subtasks.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-2 space-y-1">
          {task.subtasks.map((st) => (
            <label
              key={st.id}
              className="flex items-center gap-2.5 py-1 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={st.isCompleted}
                onChange={() => toggleSubtask(st.id, st.isCompleted)}
                className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
              />
              <span
                className={`text-xs leading-relaxed ${
                  st.isCompleted ? "line-through text-slate-400" : "text-slate-600"
                }`}
              >
                {st.title}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}