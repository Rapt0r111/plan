// features/zen-mode/ZenMode.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useKeyboardShortcuts } from "@/shared/lib/hooks/useKeyboardShortcuts";
import { useZenSession } from "./model/useZenSession";
import { AuroraBackground } from "./ui/AuroraBackground";
import { ZenTaskCard } from "./ui/ZenTaskCard";
import { ZenComplete } from "./ui/ZenComplete";

export function ZenMode() {
  const {
    isActive, currentTask, sessionStats,
    deactivate, nextTask, handleComplete,
    queueLeft, elapsed,
  } = useZenSession();

  useKeyboardShortcuts([
    { key: "Escape", handler: () => { if (isActive) deactivate(); } },
    { key: " ",      handler: () => { if (isActive && currentTask) nextTask(); } },
  ]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="zen-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-9999 flex flex-col overflow-hidden"
          style={{ isolation: "isolate" }}
        >
          <AuroraBackground />

          {/* Top bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative z-10 flex-none flex items-center justify-between px-6 pt-4 pb-2"
          >
            <div className="flex items-center gap-3 text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
              {sessionStats.completed > 0 && <span>✓ {sessionStats.completed}</span>}
              {elapsed > 0 && <span>⏱ {elapsed} мин</span>}
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono"
              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)",
                color: "rgba(139,92,246,0.7)" }}>
              <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: "#8b5cf6" }}
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 3, repeat: Infinity }} />
              ZEN MODE
            </div>

            <button onClick={deactivate}
              className="flex items-center gap-1.5 text-xs font-mono transition-all"
              style={{ color: "rgba(255,255,255,0.2)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.2)"; }}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
              esc
            </button>
          </motion.div>

          {/* Center — task card */}
          <div className="relative z-10 flex-1 flex items-center justify-center overflow-hidden px-6 py-4 min-h-0">
            <AnimatePresence mode="wait">
              {currentTask ? (
                <ZenTaskCard
                  key={currentTask.id}
                  task={currentTask}
                  onComplete={handleComplete}
                  onSkip={nextTask}
                  queueLeft={queueLeft}
                />
              ) : (
                <ZenComplete
                  key="complete"
                  onDeactivate={deactivate}
                  completed={sessionStats.completed}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Bottom hint */}
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="relative z-10 flex-none text-center text-xs font-mono pb-4"
            style={{ color: "rgba(255,255,255,0.08)" }}
          >
            esc — выход · пробел — пропустить
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}