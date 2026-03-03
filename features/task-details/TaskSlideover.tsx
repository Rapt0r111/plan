"use client";
/**
 * @file TaskSlideover.tsx — features/task-details
 *
 * Slide-over panel for full task details.
 *
 * UX rationale:
 *  Slide-over (vs modal) keeps spatial context — user sees board beneath
 *  through the blurred backdrop. This is the "focus without losing context"
 *  principle from macOS Spotlight / Linear side panels.
 *
 * Animation: spring-based slide from right with backdrop fade.
 * Width: 480px fixed — wide enough for subtasks, narrow enough to see board.
 */
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatDate } from "@/shared/lib/utils";
import { SubtaskList } from "./SubtaskList";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { TaskView, TaskStatus, TaskPriority } from "@/shared/types";

const STATUS_CFG: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  todo:        { label: "К работе",     bg: "rgba(100,116,139,0.18)", text: "#94a3b8" },
  in_progress: { label: "В работе",      bg: "rgba(14,165,233,0.18)",  text: "#38bdf8" },
  done:        { label: "Готово",        bg: "rgba(16,185,129,0.18)",  text: "#34d399" },
  blocked:     { label: "Заблокировано", bg: "rgba(239,68,68,0.18)",   text: "#f87171" },
};

const PRIORITY_CFG: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: "Критично", color: "#ef4444" },
  high:     { label: "Высокий",  color: "#f97316" },
  medium:   { label: "Средний",  color: "#eab308" },
  low:      { label: "Низкий",   color: "#475569" },
};

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done", "blocked"];

interface Props {
  task: TaskView | null;
  onClose: () => void;
}

export function TaskSlideover({ task, onClose }: Props) {
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
  const updateTaskPriority = useTaskStore((s) => s.updateTaskPriority);
  const liveTask = useTaskStore((s) => (task ? (s.getTask(task.id) ?? task) : null));

  return (
    <AnimatePresence>
      {liveTask && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30"
            style={{ backdropFilter: "blur(4px)", background: "rgba(8,9,15,0.5)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 h-screen z-40 flex flex-col overflow-hidden"
            style={{
              width: "480px",
              background: "var(--bg-surface)",
              borderLeft: "1px solid var(--glass-border)",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-start gap-4 border-b"
              style={{ borderColor: "var(--glass-border)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)] font-mono mb-1">
                  #{liveTask.id}
                </p>
                <h2 className="text-base font-semibold text-[var(--text-primary)] leading-snug">
                  {liveTask.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-02)] transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Description */}
              {liveTask.description && (
                <div>
                  <Label>Описание</Label>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-1.5">
                    {liveTask.description}
                  </p>
                </div>
              )}

              {/* Status + Priority row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Статус</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {STATUS_ORDER.map((s) => {
                      const { label, bg, text } = STATUS_CFG[s];
                      const active = liveTask.status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => updateTaskStatus(liveTask.id, s)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150"
                          style={
                            active
                              ? { backgroundColor: bg, color: text, boxShadow: `0 0 8px ${text}30` }
                              : { backgroundColor: "var(--glass-01)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" }
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label>Приоритет</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(["critical", "high", "medium", "low"] as TaskPriority[]).map((p) => {
                      const { label, color } = PRIORITY_CFG[p];
                      const active = liveTask.priority === p;
                      return (
                        <button
                          key={p}
                          onClick={() => updateTaskPriority(liveTask.id, p)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150"
                          style={
                            active
                              ? { backgroundColor: `${color}22`, color, borderColor: `${color}44`, border: "1px solid", boxShadow: `0 0 8px ${color}20` }
                              : { backgroundColor: "var(--glass-01)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" }
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Assignees */}
              {liveTask.assignees.length > 0 && (
                <div>
                  <Label>Ответственные</Label>
                  <div className="mt-2 space-y-1.5">
                    {liveTask.assignees.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                        style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: a.roleMeta.hex }}
                        >
                          {a.initials}
                        </div>
                        <span className="text-sm text-[var(--text-primary)]">{a.name}</span>
                        <span
                          className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${a.roleMeta.hex}22`, color: a.roleMeta.hex }}
                        >
                          {a.roleMeta.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Due date */}
              {liveTask.dueDate && (
                <div>
                  <Label>Дедлайн</Label>
                  <p className="text-sm font-mono text-[var(--text-secondary)] mt-1.5">
                    {formatDate(liveTask.dueDate)}
                  </p>
                </div>
              )}

              {/* Subtasks */}
              <SubtaskList taskId={liveTask.id} subtasks={liveTask.subtasks} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest">
      {children}
    </p>
  );
}