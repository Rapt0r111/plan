"use client";
/**
 * @file ZenMode.tsx — features/zen-mode
 *
 * FIX v2 — что изменилось:
 *
 *  ПРОБЛЕМА: Длинные списки подзадач уходили за нижний край экрана.
 *
 *  РЕШЕНИЕ:
 *  1. Overlay — flex-col, overflow-hidden (не скроллируется сам)
 *  2. Карточка — flex-col, max-h: 80vh, overflow-hidden снаружи
 *  3. Заголовок и кнопки — flex-none (всегда видны)
 *  4. Список подзадач — flex-1, overflow-y-auto (скроллируется)
 *  5. Footer — flex-none + box-shadow вверх (отделяет от списка)
 *
 *  ДОПОЛНИТЕЛЬНО:
 *  - Счётчик оставшихся задач в очереди ("ещё N")
 *  - Пустое состояние показывает кол-во выполненных за сессию
 *  - particles стабилизированы через useRef (не пересоздаются)
 *  - zIndex частиц явно 20 чтобы не перекрывать modal-стек
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useZenStore } from "./useZenStore";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useKeyboardShortcuts } from "@/shared/lib/hooks/useKeyboardShortcuts";
import { cn } from "@/shared/lib/utils";
import type { TaskView } from "@/shared/types";

// ─── Aurora Background ────────────────────────────────────────────────────────

function AuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "#000000" }}>
      <motion.div
        className="absolute"
        style={{
          inset: "-20%",
          background: "radial-gradient(ellipse 60% 40% at 30% 40%, rgba(139,92,246,0.12) 0%, transparent 70%)",
          willChange: "transform",
        }}
        animate={{ scale: [1, 1.08, 1], x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute"
        style={{
          inset: "-20%",
          background: "radial-gradient(ellipse 50% 35% at 70% 60%, rgba(56,189,248,0.07) 0%, transparent 65%)",
          willChange: "transform",
        }}
        animate={{ scale: [1, 1.12, 1], x: [0, -25, 0], y: [0, 20, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute"
        style={{
          inset: "-20%",
          background: "radial-gradient(ellipse 45% 30% at 50% 80%, rgba(52,211,153,0.05) 0%, transparent 60%)",
          willChange: "transform",
        }}
        animate={{ scale: [1, 1.06, 1], x: [0, 15, -10, 0], y: [0, 10, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />
    </div>
  );
}

// ─── Dissolve Particles ───────────────────────────────────────────────────────

function DissolveParticles({ active }: { active: boolean }) {
  // useRef — частицы стабильны между рендерами, не пересоздаются
  const particles = useRef(
    Array.from({ length: 36 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 36 + (Math.random() - 0.5) * 0.8;
      const dist  = 40 + Math.random() * 120;
      return {
        id:    i,
        angle, dist,
        size:  2 + Math.random() * 5,
        delay: Math.random() * 0.15,
        dur:   0.5 + Math.random() * 0.6,
        color: ["#8b5cf6","#a78bfa","#c4b5fd","#34d399","#ffffff","#38bdf8"][
          Math.floor(Math.random() * 6)
        ],
      };
    })
  ).current;

  return (
    <AnimatePresence>
      {active && particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, scale: 0, x: "50%", y: "50%" }}
          animate={{ opacity: p.size / 7, scale: 1, x: "50%", y: "50%" }}
          exit={{
            opacity: 0, scale: 0,
            x: `calc(50% + ${Math.cos(p.angle) * p.dist}px)`,
            y: `calc(50% + ${Math.sin(p.angle) * p.dist}px)`,
            transition: { duration: p.dur, delay: p.delay, ease: [0.2, 0, 0.8, 1] },
          }}
          style={{
            position: "absolute",
            width: p.size, height: p.size,
            borderRadius: "50%",
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            willChange: "transform",
            pointerEvents: "none",
            zIndex: 20,
          }}
        />
      ))}
    </AnimatePresence>
  );
}

// ─── Breathing Ring ───────────────────────────────────────────────────────────

function BreathingRing() {
  return (
    <motion.div
      className="absolute inset-0 rounded-2xl pointer-events-none"
      animate={{
        boxShadow: [
          "0 0 0 0px rgba(139,92,246,0.0)",
          "0 0 0 10px rgba(139,92,246,0.07)",
          "0 0 0 0px rgba(139,92,246,0.0)",
        ],
        borderColor: [
          "rgba(139,92,246,0.08)",
          "rgba(139,92,246,0.22)",
          "rgba(139,92,246,0.08)",
        ],
      }}
      style={{ border: "1px solid rgba(139,92,246,0.08)" }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  critical: { color: "#ef4444", label: "Критично" },
  high:     { color: "#f97316", label: "Высокий"  },
  medium:   { color: "#eab308", label: "Средний"  },
  low:      { color: "#475569", label: "Низкий"   },
};

// ─── Zen Task Card ────────────────────────────────────────────────────────────

function ZenTaskCard({
  task,
  onComplete,
  onSkip,
  queueLeft,
}: {
  task: TaskView;
  onComplete: () => void;
  onSkip: () => void;
  queueLeft: number;
}) {
  const liveTask     = useTaskStore((s) => s.getTask(task.id)) ?? task;
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
  const [dissolving, setDissolving]     = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  const priority   = PRIORITY_META[liveTask.priority];
  const progressPct = liveTask.subtasks.length > 0
    ? (liveTask.progress.done / liveTask.progress.total) * 100
    : 0;

  function handleComplete() {
    setShowParticles(true);
    setDissolving(true);
    setTimeout(() => { setShowParticles(false); onComplete(); }, 900);
  }

  return (
    <motion.div
      key={liveTask.id}
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={
        dissolving
          ? { opacity: 0, scale: 1.02, filter: "blur(8px)" }
          : { opacity: 1, scale: 1,    y: 0, filter: "blur(0px)" }
      }
      transition={
        dissolving
          ? { duration: 0.7, ease: [0.4, 0, 1, 1] }
          : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
      }
      // ключевое: flex-col + ограничение по высоте
      className="relative w-full max-w-lg flex flex-col"
      style={{ maxHeight: "80vh" }}
    >
      {/* Particles — поверх карточки */}
      <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 20 }}>
        <DissolveParticles active={showParticles} />
      </div>

      {/* Card shell — flex-col, overflow-hidden */}
      <div
        className="relative flex flex-col overflow-hidden rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <BreathingRing />

        {/* ── HEADER (flex-none — не скроллируется) ──────────────── */}
        <div className="flex-none px-6 pt-6 pb-4 space-y-4">
          {/* Row: task id · queue counter · priority */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between"
          >
            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.18)" }}>
              #{liveTask.id}
            </span>
            <div className="flex items-center gap-2">
              {queueLeft > 1 && (
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.25)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  ещё {queueLeft - 1}
                </span>
              )}
              {priority && (
                <div
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  style={{
                    background: `${priority.color}15`,
                    border: `1px solid ${priority.color}30`,
                    color: priority.color,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: priority.color }}
                  />
                  {priority.label}
                </div>
              )}
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-xl font-semibold leading-snug text-center"
            style={{
              color: "rgba(255,255,255,0.93)",
              textShadow: "0 0 40px rgba(139,92,246,0.3)",
            }}
          >
            {liveTask.title}
          </motion.h1>

          {/* Description */}
          {liveTask.description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-center leading-relaxed"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              {liveTask.description}
            </motion.p>
          )}

          {/* Progress bar (только если есть подзадачи) */}
          {liveTask.subtasks.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Подзадачи
                </span>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {liveTask.progress.done}/{liveTask.progress.total}
                </span>
              </div>
              <div className="h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #8b5cf6, #34d399)",
                    boxShadow: "0 0 8px rgba(139,92,246,0.5)",
                  }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* ── SCROLLABLE SUBTASK LIST (flex-1, overflow-y-auto) ────── */}
        {liveTask.subtasks.length > 0 && (
          <div
            className="flex-1 overflow-y-auto px-6 min-h-0"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.2) transparent" }}
          >
            <div className="divide-y divide-[rgba(255,255,255,0.04)] pb-2">
              {liveTask.subtasks.map((st, i) => (
                <motion.label
                  key={st.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.28 + i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex items-center gap-3.5 py-2.5 cursor-pointer"
                  onClick={() => toggleSubtask(liveTask.id, st.id, st.isCompleted)}
                >
                  {/* Checkbox */}
                  <div
                    className={cn(
                      "w-5 h-5 rounded-md shrink-0 flex items-center justify-center transition-all duration-300 border",
                      st.isCompleted
                        ? "border-[#8b5cf6] bg-[#8b5cf6] shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                        : "border-[rgba(255,255,255,0.14)] bg-transparent group-hover:border-[rgba(139,92,246,0.45)]"
                    )}
                  >
                    <AnimatePresence>
                      {st.isCompleted && (
                        <motion.svg
                          initial={{ scale: 0, rotate: -20 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ duration: 0.18, ease: "backOut" }}
                          className="w-3 h-3 text-white"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 6l3 3 5-5" />
                        </motion.svg>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "text-sm leading-relaxed transition-all duration-300 select-none",
                      st.isCompleted
                        ? "line-through text-[rgba(255,255,255,0.2)]"
                        : "text-[rgba(255,255,255,0.55)] group-hover:text-[rgba(255,255,255,0.82)]"
                    )}
                  >
                    {st.title}
                  </span>
                </motion.label>
              ))}
            </div>
          </div>
        )}

        {/* Assignees — только если нет подзадач */}
        {liveTask.assignees.length > 0 && liveTask.subtasks.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="flex-none flex items-center justify-center gap-2 flex-wrap px-6 pb-4"
          >
            {liveTask.assignees.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                style={{
                  background: `${a.roleMeta.hex}15`,
                  border: `1px solid ${a.roleMeta.hex}28`,
                  color: a.roleMeta.hex,
                }}
              >
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ backgroundColor: a.roleMeta.hex }}
                >
                  {a.initials}
                </div>
                {a.roleMeta.label}
              </div>
            ))}
          </motion.div>
        )}

        {/* ── FOOTER — кнопки (flex-none, прилеплен к низу) ──────── */}
        <div
          className="flex-none px-6 py-4 flex items-center gap-3"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "0 -8px 20px rgba(0,0,0,0.35)",
          }}
        >
          {/* Skip */}
          <button
            onClick={onSkip}
            className="flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.3)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 7h10M7 3l4 4-4 4" />
            </svg>
            Пропустить
          </button>

          {/* Complete */}
          <motion.button
            onClick={handleComplete}
            disabled={dissolving}
            className="flex-1 relative flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #8b5cf6 0%, #34d399 100%)",
              color: "#fff",
              boxShadow: "0 0 30px rgba(139,92,246,0.3), 0 8px 24px rgba(0,0,0,0.3)",
            }}
            whileHover={!dissolving ? { scale: 1.01, boxShadow: "0 0 40px rgba(139,92,246,0.4), 0 12px 32px rgba(0,0,0,0.4)" } : {}}
            whileTap={!dissolving ? { scale: 0.99 } : {}}
            transition={{ duration: 0.15 }}
          >
            {/* Shimmer */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
              }}
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
            />
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function ZenComplete({ onDeactivate, completed }: { onDeactivate: () => void; completed: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="text-center space-y-6"
    >
      <motion.div
        className="text-5xl"
        animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 1.2, delay: 0.3, ease: "easeInOut" }}
      >
        ✦
      </motion.div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
          {completed > 0 ? `Выполнено ${completed}` : "Всё выполнено"}
        </h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
          {completed > 0
            ? `задач${completed === 1 ? "а" : completed < 5 ? "и" : ""} за сессию`
            : "Очередь задач пуста"}
        </p>
      </div>
      <button
        onClick={onDeactivate}
        className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{
          background: "rgba(139,92,246,0.14)",
          border: "1px solid rgba(139,92,246,0.28)",
          color: "#a78bfa",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        Вернуться к доске
      </button>
    </motion.div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ZenMode() {
  const { isActive, currentTask, taskQueue, sessionStats, deactivate, markCompleted, nextTask } =
    useZenStore();
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);

  useKeyboardShortcuts([
    { key: "Escape", handler: () => { if (isActive) deactivate(); } },
    { key: " ",      handler: () => { if (isActive && currentTask) nextTask(); } },
  ]);

  const handleComplete = useCallback(async () => {
    if (!currentTask) return;
    await updateTaskStatus(currentTask.id, "done");
    markCompleted();
  }, [currentTask, markCompleted, updateTaskStatus]);

  const elapsed = sessionStats.startedAt
    ? Math.floor((Date.now() - sessionStats.startedAt.getTime()) / 60000)
    : 0;

  const queueLeft = currentTask
    ? taskQueue.slice(taskQueue.findIndex((t) => t.id === currentTask.id)).length
    : 0;

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="zen-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          // Overlay — flex-col, overflow-hidden — карточка не вылезает за экран
          className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
          style={{ isolation: "isolate" }}
        >
          <AuroraBackground />

          {/* Top bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative z-10 flex-none flex items-center justify-between px-6 pt-4 pb-2"
          >
            <div className="flex items-center gap-3 text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
              {sessionStats.completed > 0 && <span>✓ {sessionStats.completed}</span>}
              {elapsed > 0 && <span>⏱ {elapsed} мин</span>}
            </div>

            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono"
              style={{
                background: "rgba(139,92,246,0.1)",
                border: "1px solid rgba(139,92,246,0.2)",
                color: "rgba(139,92,246,0.7)",
              }}
            >
              <motion.span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#8b5cf6" }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              ZEN MODE
            </div>

            <button
              onClick={deactivate}
              className="flex items-center gap-1.5 text-xs font-mono transition-all"
              style={{ color: "rgba(255,255,255,0.2)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.2)"; }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
              esc
            </button>
          </motion.div>

          {/* Center — карточка. flex-1 + overflow-hidden = карточка не выходит за экран */}
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
                <ZenComplete key="complete" onDeactivate={deactivate} completed={sessionStats.completed} />
              )}
            </AnimatePresence>
          </div>

          {/* Bottom hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
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