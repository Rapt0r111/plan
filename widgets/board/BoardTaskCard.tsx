"use client";
/**
 * PATH:    widgets/board/BoardTaskCard.tsx   ← заменить существующий файл
 * CONNECT: Используется внутри widgets/board/EpicColumn.tsx через проп renderTask.
 *          Также импортируется напрямую в app/(main)/board/BoardPage.tsx.
 *          Импорт не меняется — путь тот же.
 *
 *          Новые пропы которые нужно передать из BoardPage.tsx / EpicColumn.tsx:
 *
 *   <BoardTaskCard
 *     {...task}
 *     epicColor={epic.color}          // hex — для цветных теней и частиц
 *     magnetIndex={i}                 // индекс карточки в колонке
 *     activeDragIndex={activeDragIdx} // из useBoardDnD (null если не тащим)
 *     onClick={() => openSlideover(task.id)}
 *     onStatusChange={handleStatusChange}
 *   />
 *
 * ── Типы ─────────────────────────────────────────────────────────────────────
 *   TaskStatus и TaskPriority берутся из @/shared/types (re-export из schema).
 *   Локальные объявления удалены — не переопределяем то, что уже есть в проекте.
 */

import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useVelocity,
  useTransform,
  useSpring,
  AnimatePresence,
} from "framer-motion";
// Используем типы из единого источника истины — schema через shared/types
import type { TaskStatus, TaskPriority } from "@/shared/types";

/* ── Props ─────────────────────────────────────────────────────────────────── */
export interface BoardTaskCardProps {
  id:               string;
  title:            string;
  status:           TaskStatus;
  priority:         TaskPriority;
  epicColor?:       string;
  assignee?:        string;
  dueDate?:         string | null;
  tags?:            string[];
  subtasks?:        { total: number; done: number };
  isDragging?:      boolean;
  magnetIndex?:     number;
  activeDragIndex?: number | null;
  onClick?:         () => void;
  onDragStart?:     (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?:       (e: React.DragEvent<HTMLDivElement>) => void;
  onStatusChange?:  (id: string, status: TaskStatus) => void;
}

/* ── UI constants ──────────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  todo:          { label: "To Do",       bg: "var(--status-todo-bg)",     text: "var(--status-todo-text)",     dot: "var(--color-todo)"        },
  "in-progress": { label: "In Progress", bg: "var(--status-progress-bg)", text: "var(--status-progress-text)", dot: "var(--color-in-progress)" },
  done:          { label: "Done",        bg: "var(--status-done-bg)",     text: "var(--status-done-text)",     dot: "var(--color-done)"        },
  blocked:       { label: "Blocked",     bg: "var(--status-blocked-bg)",  text: "var(--status-blocked-text)",  dot: "var(--color-blocked)"     },
};

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
  critical: { color: "var(--priority-critical)", label: "Critical" },
  high:     { color: "var(--priority-high)",     label: "High"     },
  medium:   { color: "var(--priority-medium)",   label: "Medium"   },
  low:      { color: "var(--priority-low)",      label: "Low"      },
};

/* ── Completion Burst Particles ────────────────────────────────────────────── */
// Math.random() в useRef.initial — вычисляется ровно один раз при монтировании
function CompletionBurst({ color, onDone }: { color: string; onDone: () => void }) {
  const particles = useRef(
    Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const dist  = 28 + Math.random() * 18;
      return {
        id:    i,
        px:    Math.cos(angle) * dist,
        py:    Math.sin(angle) * dist,
        size:  2 + Math.random() * 3,
        delay: Math.random() * 0.08,
      };
    })
  ).current;

  useEffect(() => {
    const t = setTimeout(onDone, 600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 10 }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute top-1/2 left-1/2 rounded-full"
          style={{ width: p.size, height: p.size, background: color }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x: p.px, y: p.py, scale: 0, opacity: 0 }}
          transition={{ duration: 0.45, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

/* ── Liquid Status Pill ────────────────────────────────────────────────────── */
// Stateless — AnimatePresence key={status} обеспечивает wipe-анимацию при смене пропа
function LiquidStatusPill({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div
      className="relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium overflow-hidden"
      style={{
        background: cfg.bg,
        color:      cfg.text,
        transition: "background 0.25s ease, color 0.25s ease",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: cfg.dot, transition: "background 0.25s ease" }}
      />
      <AnimatePresence mode="wait">
        <motion.span
          key={status}
          initial={{ clipPath: "inset(0 100% 0 0 round 4px)" }}
          animate={{ clipPath: "inset(0 0% 0 0 round 4px)"   }}
          exit={{    clipPath: "inset(0 0 0 100% round 4px)"  }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {cfg.label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────────── */
export function BoardTaskCard({
  id,
  title,
  status,
  priority,
  epicColor = "#7c3aed",
  assignee,
  dueDate,
  tags = [],
  subtasks,
  isDragging,
  magnetIndex,
  activeDragIndex,
  onClick,
  onDragStart,
  onDragEnd,
  onStatusChange,
}: BoardTaskCardProps) {
  const [isFocused,    setIsFocused]    = useState(false);
  const [showBurst,    setShowBurst]    = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // prevStatusRef отслеживает предыдущий статус без лишнего state.
  // setShowBurst завёрнут в setTimeout(0) — не синхронно в эффекте.
  const prevStatusRef = useRef<TaskStatus>(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev !== status) {
      prevStatusRef.current = status;
      if (status === "done" && prev !== "done") {
        const t = setTimeout(() => setShowBurst(true), 0);
        return () => clearTimeout(t);
      }
    }
  }, [status]);

  // Velocity-sensitive rotation во время drag
  const dragX     = useMotionValue(0);
  const velocityX = useVelocity(dragX);
  const rotate    = useTransform(velocityX, [-800, 0, 800], [-8, 0, 8]);
  const springRot = useSpring(rotate, { stiffness: 120, damping: 18 });

  // Magnetic repel соседних карточек
  const magnetY = useSpring(0, { stiffness: 200, damping: 25 });
  useEffect(() => {
    if (activeDragIndex != null && magnetIndex !== undefined) {
      const dist = magnetIndex - activeDragIndex;
      magnetY.set(Math.abs(dist) === 1 ? (dist > 0 ? 8 : -8) : 0);
    } else {
      magnetY.set(0);
    }
  }, [activeDragIndex, magnetIndex, magnetY]);

  const priorityCfg = PRIORITY_CONFIG[priority];
  const isDone      = status === "done";

  const cardShadow = isDone
    ? "0 0 0 1px rgba(52,211,153,0.2), 0 8px 24px rgba(52,211,153,0.08)"
    : "0 0 0 1px var(--glass-border), var(--shadow-card)";

  // HTML5 DnD на внешнем <div> — React.DragEvent гарантирует clientX/clientY.
  // motion.div внутри — только визуал, без конфликта с Framer PanInfo.
  function handleHtmlDragStart(e: React.DragEvent<HTMLDivElement>) {
    setIsDragActive(true);
    dragX.set(e.clientX);
    onDragStart?.(e);
  }
  function handleHtmlDragEnd(e: React.DragEvent<HTMLDivElement>) {
    setIsDragActive(false);
    onDragEnd?.(e);
  }
  function handleHtmlDrag(e: React.DragEvent<HTMLDivElement>) {
    if (e.clientX !== 0) dragX.set(e.clientX);
  }

  return (
    <div
      draggable
      data-priority={priority}
      tabIndex={0}
      className={isFocused ? "focus-heartbeat" : ""}
      style={{ position: "relative", outline: "none", cursor: "grab" }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onClick={onClick}
      onDragStart={handleHtmlDragStart}
      onDragEnd={handleHtmlDragEnd}
      onDrag={handleHtmlDrag}
    >
      <motion.div
        layoutId={id}
        style={{
          rotate:               isDragActive ? springRot : 0,
          y:                    magnetY,
          boxShadow:            cardShadow,
          borderRadius:         12,
          background:           "var(--glass-01)",
          backdropFilter:       "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border:               "1px solid var(--glass-border)",
          padding:              "10px 12px",
          userSelect:           "none",
          willChange:           "transform",
          position:             "relative",
          overflow:             "hidden",
        }}
        animate={{
          scale:   isDragging ? 0.97 : 1,
          opacity: isDragging ? 0.3  : 1,
        }}
        whileHover={{
          y:         -1,
          boxShadow: `0 0 0 1px ${epicColor}30, 0 8px 24px ${epicColor}14, var(--shadow-elevated)`,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {showBurst && (
          <CompletionBurst
            color="var(--color-done)"
            onDone={() => setShowBurst(false)}
          />
        )}

        {/* Chromatic aberration */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"
          style={{
            borderRadius: 12,
            background: `
              linear-gradient(135deg, rgba(255,80,80,0.015) 0%, transparent 35%),
              linear-gradient(225deg, rgba(80,140,255,0.018) 0%, transparent 35%)
            `,
          }}
        />

        {/* Статус + приоритет */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <LiquidStatusPill status={status} />
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: priorityCfg.color, boxShadow: `0 0 6px ${priorityCfg.color}80` }}
            title={priorityCfg.label}
          />
        </div>

        {/* Заголовок */}
        <p
          className="text-sm font-medium leading-snug mb-2"
          style={{
            color:          isDone ? "var(--text-secondary)" : "var(--text-primary)",
            textDecoration: isDone ? "line-through" : "none",
            opacity:        isDone ? 0.7 : 1,
          }}
        >
          {title}
        </p>

        {/* Теги */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded-md"
                style={{
                  background: "var(--glass-02)",
                  color:      "var(--text-muted)",
                  border:     "1px solid var(--glass-border)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Прогресс подзадач */}
        {subtasks && subtasks.total > 0 && (
          <div className="mb-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {subtasks.done}/{subtasks.total} subtasks
            </span>
            <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{ background: "var(--glass-02)" }}>
              <motion.div
                className="h-full rounded-full liquid-bar"
                style={{ color: epicColor }}
                initial={{ width: 0 }}
                animate={{ width: `${(subtasks.done / subtasks.total) * 100}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        )}

        {/* Футер */}
        {(assignee || dueDate) && (
          <div className="flex items-center justify-between gap-2 mt-1">
            {assignee && (
              <div className="flex items-center gap-1">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                  style={{ background: epicColor + "30", color: epicColor, fontSize: 9 }}
                >
                  {assignee[0].toUpperCase()}
                </span>
                <span className="text-xs truncate max-w-[80px]" style={{ color: "var(--text-muted)" }}>
                  {assignee}
                </span>
              </div>
            )}
            {dueDate && (
              <span className="text-xs font-mono ml-auto flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                {dueDate}
              </span>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}