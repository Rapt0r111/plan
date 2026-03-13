"use client";
/**
 * @file TaskCard.tsx — entities/task/ui
 *
 * 2027 HOLOGRAPHIC TASK CARD
 * ──────────────────────────
 *  • Inline subtask list — click the ring/counter to expand without opening modal
 *  • Each subtask row has a checkbox to toggle done state
 *  • Cursor-tracking specular highlight (no 3D tilt)
 *  • SVG arc progress ring with animated strokeDashoffset
 *  • Role-coloured assignee avatars with glow halos
 *  • Priority left accent with ambient bloom
 *  • Crystallised DONE state — sweep shimmer + strikethrough title
 *  • Status pill ripple-tap cycles status (todo→in_progress→done→blocked)
 */
import { useRef, useCallback, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useMotionTemplate,
  AnimatePresence,
} from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatDate } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { TaskView, TaskStatus } from "@/shared/types";

// ── Design tokens ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<
  TaskStatus,
  { label: string; bg: string; text: string; solid: string; glow: string }
> = {
  todo: {
    label: "К работе",
    bg: "rgba(100,116,139,0.14)",
    text: "#8da0b8",
    solid: "#64748b",
    glow: "rgba(100,116,139,0)",
  },
  in_progress: {
    label: "В работе",
    bg: "rgba(14,165,233,0.14)",
    text: "#38bdf8",
    solid: "#38bdf8",
    glow: "rgba(56,189,248,0.28)",
  },
  done: {
    label: "Готово",
    bg: "rgba(16,185,129,0.14)",
    text: "#34d399",
    solid: "#34d399",
    glow: "rgba(52,211,153,0.30)",
  },
  blocked: {
    label: "Заблокировано",
    bg: "rgba(239,68,68,0.14)",
    text: "#f87171",
    solid: "#f87171",
    glow: "rgba(239,68,68,0.24)",
  },
};

const PRIORITY_CFG: Record<string, { color: string; glow: string }> = {
  critical: { color: "#ef4444", glow: "rgba(239,68,68,0.22)" },
  high:     { color: "#f97316", glow: "rgba(249,115,22,0.18)" },
  medium:   { color: "#eab308", glow: "rgba(234,179,8,0.14)"  },
  low:      { color: "#475569", glow: "rgba(71,85,105,0.08)"  },
};

const STATUS_CYCLE: TaskStatus[] = ["todo", "in_progress", "done", "blocked"];

// ── SVG Subtask Ring (clickable) ──────────────────────────────────────────────

function SubtaskRing({
  done, total, color, expanded, onToggle,
}: {
  done: number; total: number; color: string; expanded: boolean; onToggle: (e: React.MouseEvent) => void;
}) {
  const R = 13;
  const C = 2 * Math.PI * R;
  const pct = total > 0 ? done / total : 0;

  return (
    <motion.button
      onClick={onToggle}
      title={expanded ? "Скрыть подзадачи" : "Показать подзадачи"}
      className="relative shrink-0 rounded-full"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92 }}
      style={{ outline: "none" }}
    >
      <svg
        width="34" height="34" viewBox="0 0 34 34"
        className="-rotate-90"
        style={{ filter: `drop-shadow(0 0 ${expanded ? 6 : 4}px ${color}${expanded ? "99" : "55"})` }}
      >
        <circle cx="17" cy="17" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" />
        <motion.circle
          cx="17" cy="17" r={R}
          fill="none" stroke={color}
          strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
        <text
          x="17" y="17" textAnchor="middle" dominantBaseline="central"
          fontSize="6.5" fontFamily="'DM Mono', monospace" fontWeight="500"
          fill={pct === 1 ? color : "rgba(255,255,255,0.45)"}
          transform="rotate(90 17 17)"
        >
          {done}/{total}
        </text>
      </svg>

      {/* Expanded indicator dot */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Subtask row ───────────────────────────────────────────────────────────────

function SubtaskRow({
  subtask, color, onToggle,
}: {
  subtask: { id: number; title: string; isCompleted: boolean };
  color: string;
  onToggle: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div layout className="flex items-start gap-2">
      {/* Checkbox */}
      <motion.button
        onClick={onToggle}
        whileTap={{ scale: 0.85 }}
        className="shrink-0 mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center"
        style={{
          background: subtask.isCompleted ? color : "transparent",
          border: `1.5px solid ${subtask.isCompleted ? color : "rgba(255,255,255,0.18)"}`,
          boxShadow: subtask.isCompleted ? `0 0 8px ${color}60` : "none",
          transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <AnimatePresence>
          {subtask.isCompleted && (
            <motion.svg
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15, type: "spring", stiffness: 500 }}
              width="8" height="8" viewBox="0 0 8 8"
              fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M1.5 4l2 2 3-3" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Title */}
      <span
        className="text-[11px] leading-snug flex-1"
        style={{
          color: subtask.isCompleted ? "var(--text-muted)" : "var(--text-secondary)",
          textDecorationLine: subtask.isCompleted ? "line-through" : "none",
          textDecorationColor: "rgba(255,255,255,0.2)",
          opacity: subtask.isCompleted ? 0.55 : 1,
          transition: "color 0.15s, opacity 0.15s",
        }}
      >
        {subtask.title}
      </span>
    </motion.div>
  );
}

// ── Inline subtask list ───────────────────────────────────────────────────────

function SubtaskList({
  task, color, onToggleSubtask,
}: {
  task: TaskView;
  color: string;
  onToggleSubtask: (subtaskId: number, current: boolean, e: React.MouseEvent) => void;
}) {
  const allDone = task.subtasks.length > 0 && task.subtasks.every((s) => s.isCompleted);

  return (
    <motion.div
      key="subtask-list"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ overflow: "hidden" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="mt-1 pt-2.5 flex flex-col gap-1.5"
        style={{ borderTop: `1px solid rgba(255,255,255,0.06)` }}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
            Подзадачи
          </span>
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            {task.progress.done}/{task.progress.total}
          </span>
          <AnimatePresence>
            {allDone && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                className="text-[10px]"
                style={{ color: "#34d399" }}
              >
                ✦ Все готово
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Rows */}
        {task.subtasks.map((subtask, idx) => (
          <motion.div
            key={subtask.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03, duration: 0.2 }}
          >
            <SubtaskRow
              subtask={subtask}
              color={color}
              onToggle={(e) => onToggleSubtask(subtask.id, subtask.isCompleted, e)}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Assignee Stack ────────────────────────────────────────────────────────────

function AssigneeStack({ task }: { task: TaskView }) {
  if (!task.assignees.length) return null;
  return (
    <div className="flex items-center -space-x-2">
      {task.assignees.slice(0, 3).map((a, i) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05, type: "spring", stiffness: 400, damping: 22 }}
          title={`${a.name} — ${a.roleMeta.label}`}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
          style={{
            backgroundColor: a.roleMeta.hex,
            boxShadow: `0 0 0 1.5px var(--bg-overlay), 0 0 8px ${a.roleMeta.hex}50`,
            zIndex: 3 - i,
          }}
        >
          {a.initials}
        </motion.div>
      ))}
      {task.assignees.length > 3 && (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-mono"
          style={{
            background: "var(--glass-02)",
            border: "1.5px solid var(--glass-border)",
            color: "var(--text-muted)",
            boxShadow: "0 0 0 1.5px var(--bg-overlay)",
          }}
        >
          +{task.assignees.length - 3}
        </div>
      )}
    </div>
  );
}

// ── Status Pill ───────────────────────────────────────────────────────────────

function StatusPill({ status, onCycle }: { status: TaskStatus; onCycle: (e: React.MouseEvent) => void }) {
  const cfg = STATUS_CFG[status];
  return (
    <motion.button
      onClick={onCycle}
      whileTap={{ scale: 0.88 }}
      className="relative overflow-hidden flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium select-none"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.text,
        boxShadow: `0 0 10px ${cfg.glow}`,
        border: `1px solid ${cfg.solid}18`,
      }}
    >
      <motion.span
        className="absolute inset-0 rounded-full pointer-events-none"
        initial={{ scale: 0, opacity: 0.5 }}
        whileTap={{ scale: 3, opacity: 0 }}
        transition={{ duration: 0.4 }}
        style={{ backgroundColor: cfg.solid, originX: "50%", originY: "50%" }}
      />
      <motion.span
        className="w-1.5 h-1.5 rounded-full shrink-0 relative z-10"
        style={{ backgroundColor: cfg.solid }}
        animate={status === "in_progress" ? { scale: [1, 1.6, 1], opacity: [1, 0.4, 1] } : {}}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="relative z-10">{cfg.label}</span>
    </motion.button>
  );
}

// ── Done crystal overlay ──────────────────────────────────────────────────────

function DoneOverlay() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.05) 0%, transparent 60%)" }}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(105deg, transparent 30%, rgba(52,211,153,0.10) 50%, transparent 70%)",
        }}
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  task: TaskView;
  onOpen?: (task: TaskView) => void;
  isFocused?: boolean;
}

export function TaskCard({ task, onOpen, isFocused }: Props) {
  const cardRef            = useRef<HTMLDivElement>(null);
  const updateTaskStatus   = useTaskStore((s) => s.updateTaskStatus);
  const toggleSubtask      = useTaskStore((s) => s.toggleSubtask);
  const liveTask           = useTaskStore((s) => s.getTask(task.id)) ?? task;
  const [subtasksOpen, setSubtasksOpen] = useState(false);

  // Specular cursor glow — no 3D tilt (preserve-3d causes text blur + broken hit-testing)
  const mouseX  = useMotionValue(0.5);
  const mouseY  = useMotionValue(0.5);
  const glareX  = useTransform(mouseX, [0, 1], ["0%", "100%"]);
  const glareY  = useTransform(mouseY, [0, 1], ["0%", "100%"]);
  const glareBg = useMotionTemplate`radial-gradient(130px circle at ${glareX} ${glareY}, rgba(255,255,255,0.055) 0%, transparent 70%)`;

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseX.set((e.clientX - r.left) / r.width);
    mouseY.set((e.clientY - r.top) / r.height);
  }, [mouseX, mouseY]);

  const onMouseLeave = useCallback(() => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  }, [mouseX, mouseY]);

  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const idx = STATUS_CYCLE.indexOf(liveTask.status as TaskStatus);
    updateTaskStatus(liveTask.id, STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
  }

  function handleToggleSubtasks(e: React.MouseEvent) {
    e.stopPropagation();
    setSubtasksOpen((v) => !v);
  }

  function handleToggleSubtask(subtaskId: number, current: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    toggleSubtask(liveTask.id, subtaskId, current);
  }

  const pCfg   = PRIORITY_CFG[liveTask.priority] ?? PRIORITY_CFG.low;
  const isDone = liveTask.status === "done";
  const hasSubtasks = liveTask.subtasks.length > 0;

  return (
    <motion.div
      ref={cardRef}
      onClick={() => onOpen?.(liveTask)}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      data-priority={liveTask.priority}
      className={cn(
        "relative rounded-xl overflow-hidden cursor-pointer select-none",
        isFocused && "focus-heartbeat"
      )}
      style={{
        background: isDone
          ? "linear-gradient(155deg, rgba(13,20,28,0.98) 0%, rgba(10,18,22,0.98) 100%)"
          : "var(--bg-overlay)",
        border: isDone
          ? "1px solid rgba(52,211,153,0.16)"
          : subtasksOpen
            ? `1px solid ${pCfg.color}35`
            : "1px solid var(--glass-border)",
        boxShadow: isFocused
          ? `0 0 0 2px var(--accent-400), 0 0 20px rgba(139,92,246,0.2)`
          : subtasksOpen
            ? `inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px ${pCfg.glow}`
            : "inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 10px rgba(0,0,0,0.3)",
      }}
      whileHover={{
        y: -2,
        boxShadow: isFocused
          ? `0 0 0 2px var(--accent-400), 0 0 20px rgba(139,92,246,0.2)`
          : `0 0 0 1px ${pCfg.color}28, 0 8px 28px ${pCfg.glow}, inset 0 1px 0 rgba(255,255,255,0.07)`,
      }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
    >
      {/* Priority left accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r-full"
        style={{ backgroundColor: pCfg.color, boxShadow: `3px 0 14px ${pCfg.glow}` }}
      />

      {/* Done crystal overlay */}
      <AnimatePresence>{isDone && <DoneOverlay />}</AnimatePresence>

      {/* Cursor specular highlight */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ background: glareBg }}
      />

      <div className="pl-4 pr-3.5 py-3 flex flex-col gap-2.5">
        {/* Row 1: status pill + due date */}
        <div className="flex items-center justify-between gap-2">
          <StatusPill status={liveTask.status} onCycle={cycleStatus} />
          {liveTask.dueDate && (
            <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
              {formatDate(liveTask.dueDate)}
            </span>
          )}
        </div>

        {/* Title */}
        <p
          className="text-sm font-medium leading-snug"
          style={{
            color: isDone ? "var(--text-muted)" : "var(--text-primary)",
            textDecorationLine: isDone ? "line-through" : "none",
            textDecorationColor: "rgba(52,211,153,0.45)",
          }}
        >
          {liveTask.title}
        </p>

        {/* Description */}
        {liveTask.description && (
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
            {liveTask.description}
          </p>
        )}

        {/* Bottom row: assignees + subtask ring */}
        <div className="flex items-center justify-between">
          <AssigneeStack task={liveTask} />
          {hasSubtasks && (
            <SubtaskRing
              done={liveTask.progress.done}
              total={liveTask.progress.total}
              color={isDone ? "#34d399" : pCfg.color}
              expanded={subtasksOpen}
              onToggle={handleToggleSubtasks}
            />
          )}
        </div>

        {/* Micro progress bar */}
        {hasSubtasks && (
          <div className="h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: isDone ? "#34d399" : pCfg.color }}
              initial={{ width: 0 }}
              animate={{ width: `${(liveTask.progress.done / liveTask.progress.total) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        )}

        {/* Inline subtask list */}
        <AnimatePresence initial={false}>
          {subtasksOpen && hasSubtasks && (
            <SubtaskList
              task={liveTask}
              color={isDone ? "#34d399" : pCfg.color}
              onToggleSubtask={handleToggleSubtask}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}