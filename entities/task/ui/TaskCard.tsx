"use client";
/**
 * @file TaskCard.tsx — entities/task/ui
 *
 * Premium task card with:
 *  - 3D tilt via Framer Motion useMotionValue + useTransform
 *  - SVG circular progress ring for subtask completion
 *  - Radial specular highlight that follows cursor position
 *
 * UX rationale:
 *  Tilt + highlight gives the card physical weight — it "exists" in space.
 *  The circular ring encodes progress without text, reducing cognitive load.
 *  Click anywhere cycles status; subtask ring is purely informational.
 */
import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
} from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatDate } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { TaskView, TaskStatus } from "@/shared/types";

// ─── Sub-components ───────────────────────────────────────────────────────────

/** SVG arc progress ring — 32px, no text */
function ProgressRing({
  done,
  total,
  color,
}: {
  done: number;
  total: number;
  color: string;
}) {
  const R = 12;
  const C = 2 * Math.PI * R;
  const pct = total > 0 ? done / total : 0;
  const offset = C * (1 - pct);

  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90 shrink-0">
      {/* Track */}
      <circle
        cx="16" cy="16" r={R}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="2.5"
      />
      {/* Fill */}
      <circle
        cx="16" cy="16" r={R}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      {/* Center text — rotated back */}
      <text
        x="16" y="16"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        fontFamily="DM Mono, monospace"
        fill={pct === 1 ? color : "rgba(255,255,255,0.5)"}
        transform="rotate(90 16 16)"
      >
        {total > 0 ? `${done}/${total}` : "—"}
      </text>
    </svg>
  );
}

/** Assignee avatar dot stack */
function AssigneeDots({ task }: { task: TaskView }) {
  return (
    <div className="flex items-center -space-x-1.5">
      {task.assignees.slice(0, 3).map((a, i) => (
        <div
          key={a.id}
          title={`${a.name} — ${a.roleMeta.label}`}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-1 ring-(--bg-overlay) shrink-0"
          style={{ backgroundColor: a.roleMeta.hex, zIndex: 3 - i }}
        >
          {a.initials}
        </div>
      ))}
      {task.assignees.length > 3 && (
        <div className="w-5 h-5 rounded-full bg-(--glass-02) border border-(--glass-border) flex items-center justify-center text-[9px] font-mono text-(--text-muted)">
          +{task.assignees.length - 3}
        </div>
      )}
    </div>
  );
}

const STATUS_CFG: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  todo:        { label: "К работе",     bg: "rgba(100,116,139,0.18)", text: "#94a3b8" },
  in_progress: { label: "В работе",      bg: "rgba(14,165,233,0.18)",  text: "#38bdf8" },
  done:        { label: "Готово",        bg: "rgba(16,185,129,0.18)",  text: "#34d399" },
  blocked:     { label: "Заблокировано", bg: "rgba(239,68,68,0.18)",   text: "#f87171" },
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#475569",
};

interface Props {
  task: TaskView;
  onOpen?: (task: TaskView) => void;
}

export function TaskCard({ task, onOpen }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
  const liveTask = useTaskStore((s) => s.getTask(task.id)) ?? task;

  // ── 3D tilt ──────────────────────────────────────────────────────────────
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), {
    stiffness: 300, damping: 30,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), {
    stiffness: 300, damping: 30,
  });
  const glareX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  // ── Status cycle ─────────────────────────────────────────────────────────
  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const order: TaskStatus[] = ["todo", "in_progress", "done"];
    const idx = order.indexOf(liveTask.status as TaskStatus);
    updateTaskStatus(liveTask.id, order[(idx + 1) % order.length]);
  }

  const { label, bg, text } = STATUS_CFG[liveTask.status];
  const priorityColor = PRIORITY_COLOR[liveTask.priority];

  return (
    <motion.div
      ref={cardRef}
      // Fixed: Merged all style props into one object
      style={{ 
        rotateX, 
        rotateY, 
        transformStyle: "preserve-3d",
        background: "var(--bg-overlay)",
        border: "1px solid var(--glass-border)",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onOpen?.(liveTask)}
      data-priority={liveTask.priority}
      className={cn(
        "relative rounded-xl overflow-hidden cursor-pointer select-none",
        "transition-shadow duration-200",
        "hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
      )}
      whileHover={{ z: 8 }}
    >
      {/* Specular highlight — follows cursor */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.06) 0%, transparent 60%)`,
        }}
      />

      {/* Priority left accent line is handled by [data-priority] in globals.css */}

      <div className="px-3.5 py-3 flex flex-col gap-2.5">
        {/* Top row: status pill + priority dot */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={cycleStatus}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ backgroundColor: bg, color: text }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: priorityColor }}
            />
            {label}
          </button>

          {liveTask.dueDate && (
            <span className="text-xs font-mono text-(--text-muted) shrink-0">
              {formatDate(liveTask.dueDate)}
            </span>
          )}
        </div>

        {/* Title */}
        <p
          className={cn(
            "text-sm font-medium leading-snug",
            liveTask.status === "done"
              ? "line-through text-(--text-muted)"
              : "text-(--text-primary)"
          )}
        >
          {liveTask.title}
        </p>

        {liveTask.description && (
          <p className="text-xs text-(--text-muted) line-clamp-2 leading-relaxed">
            {liveTask.description}
          </p>
        )}

        {/* Bottom row: assignees + progress ring */}
        <div className="flex items-center justify-between">
          <AssigneeDots task={liveTask} />

          {liveTask.subtasks.length > 0 && (
            <ProgressRing
              done={liveTask.progress.done}
              total={liveTask.progress.total}
              color={priorityColor}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}