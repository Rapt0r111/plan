// features/zen-mode/ui/ZenTaskCard.tsx
"use client";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { BreathingRing } from "./BreathingRing";
import { DissolveParticles } from "./DissolveParticles";
import type { TaskView } from "@/shared/types";

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  critical: { color: "#ef4444", label: "Критично" },
  high:     { color: "#f97316", label: "Высокий"  },
  medium:   { color: "#eab308", label: "Средний"  },
  low:      { color: "#475569", label: "Низкий"   },
};

interface Props {
  task: TaskView;
  onComplete: () => void;
  onSkip: () => void;
  queueLeft: number;
}

export function ZenTaskCard({ task, onComplete, onSkip, queueLeft }: Props) {
  const liveTask     = useTaskStore((s) => s.getTask(task.id)) ?? task;
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
  const [dissolving, setDissolving]       = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  const priority    = PRIORITY_META[liveTask.priority];
  const progressPct = liveTask.subtasks.length > 0
    ? (liveTask.progress.done / liveTask.progress.total) * 100 : 0;

  const handleComplete = useCallback(() => {
    setShowParticles(true);
    setDissolving(true);
    setTimeout(() => { setShowParticles(false); onComplete(); }, 900);
  }, [onComplete]);

  return (
    <motion.div
      key={liveTask.id}
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={dissolving
        ? { opacity: 0, scale: 1.02, filter: "blur(8px)" }
        : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      transition={dissolving
        ? { duration: 0.7, ease: [0.4, 0, 1, 1] }
        : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-lg flex flex-col"
      style={{ maxHeight: "80vh" }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 20 }}>
        <DissolveParticles active={showParticles} />
      </div>

      <div className="relative flex flex-col overflow-hidden rounded-2xl"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
        <BreathingRing />

        {/* Header */}
        <div className="flex-none px-6 pt-6 pb-4 space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex items-center justify-between">
            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.18)" }}>#{liveTask.id}</span>
            <div className="flex items-center gap-2">
              {queueLeft > 1 && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)",
                    border: "1px solid rgba(255,255,255,0.08)" }}>
                  ещё {queueLeft - 1}
                </span>
              )}
              {priority && (
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  style={{ background: `${priority.color}15`, border: `1px solid ${priority.color}30`, color: priority.color }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priority.color }} />
                  {priority.label}
                </div>
              )}
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-xl font-semibold leading-snug text-center"
            style={{ color: "rgba(255,255,255,0.93)", textShadow: "0 0 40px rgba(139,92,246,0.3)" }}>
            {liveTask.title}
          </motion.h1>

          {liveTask.description && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="text-sm text-center leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
              {liveTask.description}
            </motion.p>
          )}

          {liveTask.subtasks.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>Подзадачи</span>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {liveTask.progress.done}/{liveTask.progress.total}
                </span>
              </div>
              <div className="h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #8b5cf6, #34d399)", boxShadow: "0 0 8px rgba(139,92,246,0.5)" }}
                  animate={{ width: `${progressPct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
              </div>
            </motion.div>
          )}
        </div>

        {/* Scrollable subtask list */}
        {liveTask.subtasks.length > 0 && (
          <div className="flex-1 overflow-y-auto px-6 min-h-0"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.2) transparent" }}>
            <div className="divide-y divide-[rgba(255,255,255,0.04)] pb-2">
              {liveTask.subtasks.map((st, i) => (
                <motion.label key={st.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.28 + i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex items-center gap-3.5 py-2.5 cursor-pointer"
                  onClick={() => toggleSubtask(liveTask.id, st.id, st.isCompleted)}>
                  <div className={cn(
                    "w-5 h-5 rounded-md shrink-0 flex items-center justify-center transition-all duration-300 border",
                    st.isCompleted
                      ? "border-[#8b5cf6] bg-[#8b5cf6] shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                      : "border-[rgba(255,255,255,0.14)] bg-transparent group-hover:border-[rgba(139,92,246,0.45)]"
                  )}>
                    <AnimatePresence>
                      {st.isCompleted && (
                        <motion.svg initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }} transition={{ duration: 0.18, ease: "backOut" }}
                          className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6l3 3 5-5" />
                        </motion.svg>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className={cn("text-sm leading-relaxed transition-all duration-300 select-none",
                    st.isCompleted ? "line-through text-[rgba(255,255,255,0.2)]"
                      : "text-[rgba(255,255,255,0.55)] group-hover:text-[rgba(255,255,255,0.82)]")}>
                    {st.title}
                  </span>
                </motion.label>
              ))}
            </div>
          </div>
        )}

        {/* Assignees (only when no subtasks) */}
        {liveTask.assignees.length > 0 && liveTask.subtasks.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="flex-none flex items-center justify-center gap-2 flex-wrap px-6 pb-4">
            {liveTask.assignees.map((a) => (
              <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                style={{ background: `${a.roleMeta.hex}15`, border: `1px solid ${a.roleMeta.hex}28`, color: a.roleMeta.hex }}>
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ backgroundColor: a.roleMeta.hex }}>{a.initials}</div>
                {a.roleMeta.label}
              </div>
            ))}
          </motion.div>
        )}

        {/* Footer */}
        <div className="flex-none px-6 py-4 flex items-center gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 -8px 20px rgba(0,0,0,0.35)" }}>
          <button onClick={onSkip}
            className="flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all duration-200"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 7h10M7 3l4 4-4 4" />
            </svg>
            Пропустить
          </button>

          <motion.button onClick={handleComplete} disabled={dissolving}
            className="flex-1 relative flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold overflow-hidden"
            style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #34d399 100%)", color: "#fff",
              boxShadow: "0 0 30px rgba(139,92,246,0.3), 0 8px 24px rgba(0,0,0,0.3)" }}
            whileHover={!dissolving ? { scale: 1.01, boxShadow: "0 0 40px rgba(139,92,246,0.4), 0 12px 32px rgba(0,0,0,0.4)" } : {}}
            whileTap={!dissolving ? { scale: 0.99 } : {}} transition={{ duration: 0.15 }}>
            <motion.div className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)" }}
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }} />
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 8l4 4 8-8" />
            </svg>
            Выполнено
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}