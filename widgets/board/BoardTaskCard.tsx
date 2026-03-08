"use client";
/**
 * @file BoardTaskCard.tsx — widgets/board
 *
 * Dark task card with DnD support and Zustand optimistic updates.
 *
 * NEW IN v2:
 *  • TaskHoverCard: shown after 350ms hover delay, hidden on mouse leave.
 *    Rendered via portal — no z-index/overflow concerns.
 *  • Focus ring: visible when this card is the keyboard-nav focused task.
 *    Styled with accent colour + subtle outer glow.
 *
 * NEW IN v3:
 *  • 3D tilt via Framer Motion useMotionValue + useSpring + useTransform.
 *    motion.div (tilt shell) is kept separate from the inner draggable div
 *    to avoid Framer's synthetic event types conflicting with React.DragEvent.
 */
import { useState, useRef, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { RoleBadge } from "@/features/role-badge/RoleBadge";
import { formatDate } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { TaskHoverCard } from "@/features/task-details/TaskHoverCard";
import type { TaskView, TaskStatus } from "@/shared/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  todo:        { label: "К работе",      bg: "rgba(100,116,139,0.18)", text: "#94a3b8" },
  in_progress: { label: "В работе",      bg: "rgba(14,165,233,0.18)",  text: "#38bdf8" },
  done:        { label: "Готово",        bg: "rgba(16,185,129,0.18)",  text: "#34d399" },
  blocked:     { label: "Заблокировано", bg: "rgba(239,68,68,0.18)",   text: "#f87171" },
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#475569",
};

const HOVER_DELAY_MS = 350;

// ── Types ─────────────────────────────────────────────────────────────────────

interface DragProps {
  draggable: true;
  "data-dragging": boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

interface Props {
  task:       TaskView;
  dragProps:  DragProps;
  onOpen?:    (task: TaskView) => void;
  /** True when this card is the keyboard-focused task */
  isFocused?: boolean;
  /** Called when user clicks the card to update keyboard focus too */
  onFocus?:   (taskId: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BoardTaskCard({ task, dragProps, onOpen, isFocused = false, onFocus }: Props) {
  const [expanded,     setExpanded]     = useState(false);
  const [anchorEl,     setAnchorEl]     = useState<HTMLDivElement | null>(null);
  const [hoverVisible, setHoverVisible] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleSubtask    = useTaskStore((s) => s.toggleSubtask);
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
  const liveTask = useTaskStore((s) => s.getTask(task.id)) ?? task;

  const { label, bg, text } = STATUS_CFG[liveTask.status];
  const isDragging = dragProps["data-dragging"];

  // ── 3D tilt ──────────────────────────────────────────────────────────────
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(
    useTransform(mouseY, [-0.5, 0.5], [2, -2]),
    { stiffness: 400, damping: 40 },
  );
  const rotateY = useSpring(
    useTransform(mouseX, [-0.5, 0.5], [-2, 2]),
    { stiffness: 400, damping: 40 },
  );

  const glareX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

  // resetTilt is intentionally NOT wrapped in useCallback — it's a stable
  // inline closure over MotionValues (not React state), so re-creating it
  // each render is free and avoids the React Compiler dep-mismatch warning.
  function resetTilt() {
    mouseX.set(0);
    mouseY.set(0);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  // ── Hover card management ────────────────────────────────────────────────
  // useCallback omitted intentionally: React Compiler manages memoisation.
  // Adding resetTilt to the dep array would cause the "inferred dep not in
  // source" warning because resetTilt is recreated each render.
  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setHoverVisible(true), HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHoverVisible(false);
    resetTilt();
  };

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  // ── Status cycle ─────────────────────────────────────────────────────────
  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const order: TaskStatus[] = ["todo", "in_progress", "done"];
    const next = order[(order.indexOf(liveTask.status as TaskStatus) + 1) % order.length];
    updateTaskStatus(liveTask.id, next);
  }

  // ── Click handler ────────────────────────────────────────────────────────
  function handleClick() {
    onFocus?.(liveTask.id);
    onOpen?.(liveTask);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  //
  // Structure:
  //   motion.div   — owns rotateX/Y tilt + specular glare overlay.
  //                  No drag props here → avoids Framer synthetic-event
  //                  type conflicts with React.DragEvent.
  //   └─ div       — owns draggable/onDragStart/onDragEnd + all other handlers.
  //                  ref forwarded to anchorEl for TaskHoverCard positioning.
  //
  return (
    <>
      <motion.div
        style={{
          rotateX:        isDragging ? 0 : rotateX,
          rotateY:        isDragging ? 0 : rotateY,
          transformStyle: "preserve-3d",
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={isDragging ? {} : { z: 4 }}
      >
        <div
          ref={setAnchorEl}
          {...dragProps}
          data-priority={liveTask.priority}
          onClick={handleClick}
          className={cn(
            "relative rounded-xl overflow-hidden cursor-grab active:cursor-grabbing",
            "select-none transition-shadow duration-200",
            isDragging
              ? "opacity-40 scale-[0.98] ring-1 ring-[var(--accent-500)]"
              : "hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)]",
            isFocused && !isDragging && [
              "ring-2 ring-[var(--accent-500)]",
              "shadow-[0_0_0_2px_rgba(139,92,246,0.25),0_6px_20px_rgba(0,0,0,0.4)]",
            ],
          )}
          style={{
            background: "var(--bg-overlay)",
            border:     "1px solid var(--glass-border)",
          }}
        >
          {/* Specular highlight */}
          <motion.div
            className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.05) 0%, transparent 60%)`,
            }}
          />

          {/* ── Card content ──────────────────────────────────────────── */}
          <div className="px-3 py-2.5 flex items-start gap-2.5">

            {/* Status pill */}
            <button
              onClick={(e) => { e.stopPropagation(); cycleStatus(e); }}
              className="mt-0.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: bg, color: text }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: PRIORITY_DOT[liveTask.priority] }}
              />
              {label}
            </button>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-xs font-medium leading-snug",
                  liveTask.status === "done"
                    ? "line-through text-(--text-muted)"
                    : "text-[var(--text-primary)]",
                )}
              >
                {liveTask.title}
              </p>

              {liveTask.description && (
                <p className="text-xs text-(--text-muted) mt-0.5 line-clamp-1">
                  {liveTask.description}
                </p>
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
                  <span className="ml-auto text-xs font-mono text-(--text-muted)">
                    {formatDate(liveTask.dueDate)}
                  </span>
                )}
              </div>
            </div>

            {/* Subtask toggle */}
            {liveTask.subtasks.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                className="shrink-0 flex items-center gap-1 text-xs text-(--text-muted) hover:text-[var(--text-secondary)] transition-colors"
              >
                <span className="font-mono">
                  {liveTask.progress.done}/{liveTask.progress.total}
                </span>
                <svg
                  className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")}
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M2 4l4 4 4-4" />
                </svg>
              </button>
            )}
          </div>

          {/* Subtask progress bar */}
          {liveTask.subtasks.length > 0 && (
            <div className="mx-3 mb-1 h-0.5 bg-[var(--glass-02)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--accent-500)] rounded-full"
                animate={{
                  width: `${(liveTask.progress.done / liveTask.progress.total) * 100}%`,
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          )}

          {/* Expanded subtask list */}
          {expanded && (
            <div
              className="border-t border-[var(--glass-border)] px-3 py-2 space-y-1"
              onClick={(e) => e.stopPropagation()}
            >
              {liveTask.subtasks.map((st) => (
                <label key={st.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={st.isCompleted}
                    onChange={() => toggleSubtask(liveTask.id, st.id, st.isCompleted)}
                    className="w-3 h-3 rounded accent-indigo-500"
                  />
                  <span
                    className={cn(
                      "text-xs",
                      st.isCompleted
                        ? "line-through text-(--text-muted)"
                        : "text-[var(--text-secondary)]",
                    )}
                  >
                    {st.title}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Hover preview — rendered via portal */}
      <TaskHoverCard
        task={liveTask}
        anchorEl={anchorEl}
        visible={hoverVisible && !isDragging}
      />
    </>
  );
}