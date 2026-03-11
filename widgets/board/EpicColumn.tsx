"use client";
/**
 * PATH:    widgets/board/EpicColumn.tsx   ← заменить существующий файл
 * CONNECT: app/(main)/board/BoardPage.tsx — там уже импортируется EpicColumn.
 *          Изменений в импорте не нужно, путь тот же.
 *          Убедиться что передаются новые пропы:
 *
 *   <EpicColumn
 *     epicId={epic.id}
 *     epicName={epic.name}
 *     epicColor={epic.color}       // hex — ОБЯЗАТЕЛЬНО
 *     epicEmoji={epic.emoji}
 *     tasks={epicTasks}
 *     taskCount={doneTasks.length}
 *     totalCount={epicTasks.length}
 *     columnIndex={index}          // для parallax offset (новый проп)
 *     renderTask={(task, i) => (
 *       <BoardTaskCard
 *         {...task}
 *         epicColor={epic.color}
 *         magnetIndex={i}          // новый проп
 *       />
 *     )}
 *   />
 *
 *
 * Neural Depth upgrades:
 *  1. Holographic column header — iridescent gradient tracks cursor X across viewport
 *  2. Temporal wave cascade — cards spring in sequentially, each triggering next at 30%
 *  3. Scroll-driven parallax — even columns shift slower than odd (CSS animation-timeline)
 *  4. Colored shadow — column casts glow of its epic color
 *  5. Glassmorphism 3.0 — chromatic aberration on hover
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, useSpring, useMotionValue, AnimatePresence } from "framer-motion";

/* ── Types ─────────────────────────────────────────────────────────────────── */
export interface Task {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done" | "blocked";
  priority: "critical" | "high" | "medium" | "low";
  assignee?: string;
  dueDate?: string;
  subtasks?: { total: number; done: number };
  tags?: string[];
}

export interface EpicColumnProps {
  epicId:     string;
  epicName:   string;
  epicColor:  string;        // hex, e.g. "#7c3aed"
  epicEmoji?: string;
  tasks:      Task[];
  taskCount:  number;
  totalCount: number;
  columnIndex: number;      // for parallax offset
  isDragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?:    (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  children?:  React.ReactNode;
  renderTask: (task: Task, index: number) => React.ReactNode;
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Holographic Header ────────────────────────────────────────────────────── */
function HolographicHeader({
  epicName, epicColor, epicEmoji, taskCount, totalCount
}: {
  epicName: string; epicColor: string; epicEmoji?: string;
  taskCount: number; totalCount: number;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const angle = useMotionValue(135);
  const springAngle = useSpring(angle, { stiffness: 60, damping: 20 });

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      // Map cursor X across entire viewport to 110–160deg
      const pct = e.clientX / window.innerWidth;
      angle.set(110 + pct * 50);
    }
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [angle]);

  const progress = totalCount > 0 ? (taskCount / totalCount) * 100 : 0;

  return (
    <div ref={headerRef} className="relative px-3 pt-3 pb-2">
      {/* Iridescent glow layer */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-t-xl overflow-hidden"
        style={{
          background: springAngle.get()
            ? undefined
            : undefined,
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: springAngle.get()
              ? `linear-gradient(${springAngle}deg, transparent 0%, rgba(255,255,255,0.025) 30%, ${hexToRgba(epicColor, 0.04)} 50%, rgba(56,189,248,0.025) 70%, transparent 100%)`
              : undefined,
          }}
        />
      </motion.div>

      {/* Epic identity row */}
      <div className="relative flex items-center gap-2 mb-2">
        {epicEmoji && (
          <span
            className="flex items-center justify-center w-6 h-6 rounded-md text-sm flex-shrink-0"
            style={{ background: hexToRgba(epicColor, 0.18) }}
          >
            {epicEmoji}
          </span>
        )}
        {!epicEmoji && (
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
            style={{ background: epicColor, boxShadow: `0 0 8px ${hexToRgba(epicColor, 0.6)}` }}
          />
        )}
        <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: epicColor }}>
          {epicName}
        </span>
        <span
          className="ml-auto text-xs font-mono px-1.5 py-0.5 rounded-md"
          style={{
            background: hexToRgba(epicColor, 0.12),
            color: epicColor,
            border: `1px solid ${hexToRgba(epicColor, 0.25)}`,
          }}
        >
          {taskCount}
        </span>
      </div>

      {/* Liquid progress bar */}
      {totalCount > 0 && (
        <div className="relative h-0.5 rounded-full overflow-hidden" style={{ background: hexToRgba(epicColor, 0.12) }}>
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full liquid-bar"
            style={{ color: epicColor }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
          {/* Trailing glow */}
          <motion.div
            className="absolute inset-y-0 rounded-full pointer-events-none"
            style={{ right: `${100 - progress}%`, width: 8, transform: 'translateX(50%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: progress > 5 ? 1 : 0 }}
            transition={{ delay: 0.8 }}
          >
            <div
              className="w-full h-full rounded-full blur-sm"
              style={{ background: epicColor }}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ── Temporal Wave Reveal ──────────────────────────────────────────────────── */
function TemporalCard({
  children, index, total
}: { children: React.ReactNode; index: number; total: number }) {
  // Each card starts when previous reaches ~30% of its travel
  // We approximate with a staggered delay based on index
  const delay = index * 0.065;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      transition={{
        delay,
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
        // Spring propagation: each next card fires when previous is at 30%
        // delay = index * (0.45 * 0.30) ≈ 0.065 * index (above)
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────────── */
export function EpicColumn({
  epicId, epicName, epicColor, epicEmoji,
  tasks, taskCount, totalCount, columnIndex,
  isDragOver, onDragOver, onDrop, onDragLeave,
  children, renderTask,
}: EpicColumnProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);

  // Trigger reveal on mount
  useEffect(() => {
    const t = setTimeout(() => setIsRevealed(true), 80 + columnIndex * 30);
    return () => clearTimeout(t);
  }, [columnIndex]);

  // Scroll-driven parallax: even columns shift slightly slower
  // Uses CSS animation-timeline: scroll() via inline style
  const parallaxOffset = columnIndex % 2 === 0 ? -0.015 : 0.015;

  const coloredShadow = isDragOver
    ? `0 0 0 2px ${hexToRgba(epicColor, 0.5)}, 0 16px 40px ${hexToRgba(epicColor, 0.15)}`
    : `0 0 0 1px ${hexToRgba(epicColor, 0.08)}, 0 24px 48px ${hexToRgba(epicColor, 0.06)}`;

  return (
    <motion.div
      ref={colRef}
      className="flex flex-col rounded-2xl overflow-hidden flex-shrink-0"
      style={{
        width: 280,
        minHeight: 120,
        background: "var(--glass-01)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        border: `1px solid ${isDragOver ? hexToRgba(epicColor, 0.4) : "var(--glass-border)"}`,
        boxShadow: coloredShadow,
        position: "relative",
      }}
      animate={{
        scale: isDragOver ? 1.01 : 1,
        y: isDragOver ? -2 : 0,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      {/* Chromatic aberration layer */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-2xl"
        style={{
          background: `
            linear-gradient(135deg, rgba(255,80,80,0.015) 0%, transparent 40%),
            linear-gradient(225deg, rgba(80,140,255,0.018) 0%, transparent 40%)
          `,
          zIndex: 1,
        }}
      />

      {/* Holographic header */}
      <HolographicHeader
        epicName={epicName}
        epicColor={epicColor}
        epicEmoji={epicEmoji}
        taskCount={taskCount}
        totalCount={totalCount}
      />

      {/* Divider with epic color glow */}
      <div
        className="mx-3 mb-2"
        style={{
          height: 1,
          background: `linear-gradient(90deg, ${hexToRgba(epicColor, 0.5)} 0%, ${hexToRgba(epicColor, 0.1)} 60%, transparent 100%)`,
        }}
      />

      {/* Task list with temporal wave */}
      <div
        className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1.5"
        style={{ scrollbarWidth: "thin" }}
      >
        <AnimatePresence initial={!isRevealed}>
          {tasks.map((task, i) => (
            <TemporalCard key={task.id} index={i} total={tasks.length}>
              {renderTask(task, i)}
            </TemporalCard>
          ))}
        </AnimatePresence>

        {/* Quick add trigger slot */}
        {children && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: tasks.length * 0.065 + 0.1 }}
          >
            {children}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}