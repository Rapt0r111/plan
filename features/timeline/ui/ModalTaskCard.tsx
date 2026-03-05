// features/timeline/ui/ModalTaskCard.tsx
"use client";
import { useState, useCallback} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDate } from "@/shared/lib/utils";
import { MagneticCheckbox } from "@/shared/ui/MagneticCheckbox";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { TaskView, TaskStatus } from "@/shared/types";

const S: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  in_progress: { label: "В работе",       color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  todo:        { label: "К работе",       color: "#6b7fa3", bg: "rgba(107,127,163,0.12)" },
  blocked:     { label: "Заблокировано",  color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  done:        { label: "Готово",         color: "#34d399", bg: "rgba(52,211,153,0.12)" },
};

interface Props { task: TaskView; index: number; epicColor: string; }

export function ModalTaskCard({ task, index, epicColor }: Props) {
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
  const liveTask = useTaskStore((s) => s.getTask(task.id)) ?? task;
  const isDone = liveTask.status === "done";
  const cfg = S[liveTask.status];
  const [open, setOpen] = useState(false);
  const [isPopping, setIsPopping] = useState(false);
  const donePct = liveTask.progress.total > 0
    ? Math.round((liveTask.progress.done / liveTask.progress.total) * 100) : 0;

  const handleToggle = useCallback(() => {
    setIsPopping(true);
    setTimeout(() => {
      updateTaskStatus(liveTask.id, isDone ? "todo" : "done");
      setIsPopping(false);
    }, 140);
  }, [isDone, liveTask.id, updateTaskStatus]);

  return (
    <motion.div
      layout layoutId={`task-${liveTask.id}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: isPopping ? 1.04 : 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ layout: { type: "spring", stiffness: 280, damping: 28 },
        scale: { type: "spring", stiffness: 400, damping: 25 },
        opacity: { duration: 0.25, delay: index * 0.02 } }}
      className="rounded-xl overflow-hidden relative"
      style={{ background: "var(--glass-01)",
        border: `1px solid ${isDone ? "rgba(52,211,153,0.12)" : "var(--glass-border)"}` }}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === " ") { e.preventDefault(); handleToggle(); } }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5"
        style={{ cursor: liveTask.subtasks.length > 0 ? "pointer" : "default" }}
        onClick={() => liveTask.subtasks.length > 0 && setOpen((p) => !p)}>
        <div onClick={(e) => e.stopPropagation()}>
          <MagneticCheckbox checked={isDone} onChange={handleToggle} size="sm"
            accentColor={isDone ? "#34d399" : epicColor} />
        </div>
        <div className="flex-1 min-w-0 relative">
          <span className="text-sm block truncate transition-colors duration-300"
            style={{ color: isDone ? "var(--text-muted)" : "var(--text-secondary)" }}>
            {liveTask.title}
          </span>
          <AnimatePresence>
            {isDone && (
              <motion.div key="strike" initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }}
                exit={{ scaleX: 0 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-1/2 left-0 right-0 h-px pointer-events-none"
                style={{ background: "rgba(52,211,153,0.55)", marginTop: -0.5 }} />
            )}
          </AnimatePresence>
        </div>
        {liveTask.subtasks.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-02)" }}>
              <motion.div className="h-full rounded-full" animate={{ width: `${donePct}%` }}
                transition={{ duration: 0.5 }} style={{ backgroundColor: cfg.color }} />
            </div>
            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
              {liveTask.progress.done}/{liveTask.progress.total}
            </span>
          </div>
        )}
        {liveTask.dueDate && (
          <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
            {formatDate(liveTask.dueDate)}
          </span>
        )}
        <motion.span layout className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
          animate={{ background: isDone ? S.done.bg : cfg.bg, color: isDone ? S.done.color : cfg.color }}
          transition={{ duration: 0.3 }}>
          {isDone ? S.done.label : cfg.label}
        </motion.span>
        {liveTask.subtasks.length > 0 && (
          <svg className="w-3 h-3 shrink-0 transition-transform duration-200"
            style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : "rotate(0)" }}
            viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 2l4 4-4 4" />
          </svg>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden" style={{ borderTop: "1px solid var(--glass-border)" }}>
            <div className="px-3 py-2.5">
              <div className="ml-4 space-y-0.5 border-l-2 pl-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                {liveTask.subtasks.map((st) => (
                  <div key={st.id} onClick={(e) => { e.stopPropagation(); toggleSubtask(liveTask.id, st.id, st.isCompleted); }}
                    className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-md cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.04)]">
                    <div className="w-4 h-4 rounded-[4px] shrink-0 flex items-center justify-center transition-colors duration-200"
                      style={{ background: st.isCompleted ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${st.isCompleted ? "#34d399" : "rgba(255,255,255,0.15)"}` }}>
                      <AnimatePresence>
                        {st.isCompleted && (
                          <motion.svg initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }} className="w-2.5 h-2.5"
                            viewBox="0 0 8 8" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M1.5 4L3 5.5L6.5 2" />
                          </motion.svg>
                        )}
                      </AnimatePresence>
                    </div>
                    <span className="text-xs flex-1 truncate transition-all duration-300"
                      style={{ color: st.isCompleted ? "var(--text-muted)" : "var(--text-secondary)",
                        textDecoration: st.isCompleted ? "line-through" : "none" }}>
                      {st.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}