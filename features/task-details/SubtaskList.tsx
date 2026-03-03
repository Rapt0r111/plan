"use client";
/**
 * @file SubtaskList.tsx — features/task-details
 *
 * Subtask checklist with:
 *  - Animated strikethrough on completion (layout animation)
 *  - Soft amethyst glow on checked state
 *  - Stagger reveal on mount
 */
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { SubtaskView } from "@/shared/types";

interface Props {
  taskId: number;
  subtasks: SubtaskView[];
}

export function SubtaskList({ taskId, subtasks }: Props) {
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask);

  if (subtasks.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)] text-center py-6">
        Нет подзадач
      </p>
    );
  }

  const done = subtasks.filter((s) => s.isCompleted).length;
  const pct = Math.round((done / subtasks.length) * 100);

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
          Подзадачи
        </span>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          {done}/{subtasks.length} · {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-[var(--glass-02)] rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, var(--accent-500), var(--accent-400))" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* List */}
      <motion.div
        className="space-y-1"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
      >
        {subtasks.map((st) => (
          <SubtaskRow
            key={st.id}
            subtask={st}
            onToggle={() => toggleSubtask(taskId, st.id, st.isCompleted)}
          />
        ))}
      </motion.div>
    </div>
  );
}

function SubtaskRow({
  subtask,
  onToggle,
}: {
  subtask: SubtaskView;
  onToggle: () => void;
}) {
  return (
    <motion.label
      layout
      variants={{
        hidden: { opacity: 0, x: -8 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
      }}
      className="group flex items-start gap-3 px-2 py-2 rounded-xl cursor-pointer transition-colors hover:bg-[var(--glass-01)]"
      onClick={onToggle}
    >
      {/* Custom checkbox */}
      <div
        className={cn(
          "mt-0.5 w-4 h-4 rounded-md shrink-0 flex items-center justify-center transition-all duration-200",
          "border",
          subtask.isCompleted
            ? "bg-[var(--accent-500)] border-[var(--accent-500)] shadow-[0_0_8px_var(--accent-glow)]"
            : "border-[var(--glass-border-active)] bg-[var(--glass-01)] group-hover:border-[var(--accent-500)]"
        )}
      >
        <AnimatePresence>
          {subtask.isCompleted && (
            <motion.svg
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "backOut" }}
              className="w-2.5 h-2.5 text-white"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1.5 5l2.5 2.5 4.5-4.5" />
            </motion.svg>
          )}
        </AnimatePresence>
      </div>

      {/* Text with animated strikethrough */}
      <motion.span
        layout
        className={cn(
          "text-sm leading-relaxed transition-colors duration-300",
          subtask.isCompleted
            ? "line-through text-[var(--text-muted)]"
            : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
        )}
      >
        {subtask.title}
      </motion.span>
    </motion.label>
  );
}