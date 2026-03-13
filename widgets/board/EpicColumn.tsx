"use client";
/**
 * @file EpicColumn.tsx — widgets/board
 *
 * 2027 EPIC COLUMN
 * ────────────────
 *  • Collapsible body — click chevron or double-click header to collapse/expand
 *  • Smooth height animation via framer-motion layout
 *  • Removed 3D tilt (preserve-3d caused text blur on child TaskCards)
 *  • Hover glow + ambient mesh BG retained
 */
import { useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { applyFilters, type FilterState } from "@/features/filters/SmartFilters";
import { useBoardDnD } from "@/features/board/hooks/useBoardDnD";
import { TaskCard } from "@/entities/task/ui/TaskCard";
import { QuickAddTask } from "./QuickAddTask";
import { STATUS_META, STATUS_ORDER } from "@/shared/config/task-meta";
import type { EpicWithTasks, TaskView, TaskStatus } from "@/shared/types";

export interface EpicColumnProps {
  epic: EpicWithTasks;
  filters: FilterState;
  onOpenTask: (task: TaskView) => void;
  focusedTaskId: number | null;
  onFocusTask: (id: number | null) => void;
}

// ── Progress ring ──────────────────────────────────────────────────────────────
function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const size = 34;
  const R = 13;
  const C = 2 * Math.PI * R;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2} cy={size / 2} r={R}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={R}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - pct / 100) }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
      <text
        x={size / 2} y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="7"
        fontFamily="'DM Mono', monospace"
        fontWeight="700"
        fill={color}
      >
        {pct}%
      </text>
    </svg>
  );
}

// ── Status label ──────────────────────────────────────────────────────────────
function StatusLabel({
  status,
  count,
  meta,
}: {
  status: TaskStatus;
  count: number;
  meta: (typeof STATUS_META)[TaskStatus];
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
        style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
      >
        <motion.span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: meta.solid }}
          animate={status === "in_progress" ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {meta.label}
      </div>
      <motion.span
        key={count}
        initial={{ scale: 1.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="text-[10px] font-mono tabular-nums"
        style={{ color: "var(--text-muted)" }}
      >
        {count}
      </motion.span>
      <div
        className="flex-1 h-px"
        style={{ background: `linear-gradient(90deg, ${meta.color}40, transparent)` }}
      />
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({
  isActive,
  children,
  color,
}: {
  isActive: boolean;
  children: React.ReactNode;
  color: string;
}) {
  return (
    <motion.div
      animate={{
        background: isActive ? `${color}07` : "transparent",
        borderColor: isActive ? `${color}30` : "transparent",
      }}
      transition={{ duration: 0.15 }}
      className="space-y-2 min-h-[32px] rounded-xl p-1.5 relative"
      style={{ border: "1px solid transparent" }}
    >
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="drop-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, ${color}14 0%, transparent 65%)`,
              boxShadow: `inset 0 0 20px ${color}06`,
            }}
          />
        )}
      </AnimatePresence>
      {children}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="drop-line"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            className="w-full h-0.5 rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${color}70, transparent)`,
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Chevron icon ──────────────────────────────────────────────────────────────
function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <motion.svg
      width="14" height="14" viewBox="0 0 14 14"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      animate={{ rotate: collapsed ? -90 : 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <path d="M2.5 5l4.5 4 4.5-4" />
    </motion.svg>
  );
}

// ── Collapsed summary pills ────────────────────────────────────────────────────
function CollapsedSummary({
  byStatus,
  color,
}: {
  byStatus: Record<TaskStatus, TaskView[]>;
  color: string;
}) {
  const entries = STATUS_ORDER
    .map((s) => ({ status: s, count: byStatus[s].length, meta: STATUS_META[s] }))
    .filter((e) => e.count > 0);

  if (!entries.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="flex flex-wrap gap-1.5 px-4 pb-3"
    >
      {entries.map(({ status, count, meta }) => (
        <div
          key={status}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
          style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: meta.solid }}
          />
          {count}
        </div>
      ))}
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function EpicColumn({
  epic,
  filters,
  onOpenTask,
  focusedTaskId,
}: EpicColumnProps) {
  const { getDragProps, getDropProps, dragState } = useBoardDnD();
  const [hovered, setHovered] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  const visibleTasks = useMemo(() => applyFilters(epic.tasks, filters), [epic.tasks, filters]);
  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskView[]> = {
      in_progress: [],
      todo: [],
      blocked: [],
      done: [],
    };
    for (const t of visibleTasks) map[t.status]?.push(t);
    return map;
  }, [visibleTasks]);

  const pct =
    epic.progress.total > 0
      ? Math.round((epic.progress.done / epic.progress.total) * 100)
      : 0;

  function toggleCollapsed(e: React.MouseEvent) {
    e.stopPropagation();
    setCollapsed((v) => !v);
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      layout
    >
      <motion.div
        layout
        className="flex flex-col rounded-2xl overflow-hidden relative"
        animate={{
          boxShadow: hovered
            ? `0 0 0 1px ${epic.color}45, 0 24px 64px rgba(0,0,0,0.55), 0 0 48px ${epic.color}14`
            : `0 0 0 1px rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.3)`,
        }}
        transition={{ duration: 0.35 }}
        style={{
          background: "var(--bg-elevated)",
          borderLeft: `3px solid ${epic.color}`,
        }}
      >
        {/* Ambient mesh background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 75% 45% at 8% 0%, ${epic.color}12 0%, transparent 55%),
              radial-gradient(ellipse 45% 55% at 92% 100%, ${epic.color}08 0%, transparent 52%)
            `,
            opacity: hovered ? 1 : 0.65,
            transition: "opacity 0.4s ease",
          }}
        />

        {/* Top shimmer line */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: `linear-gradient(90deg, ${epic.color}90 0%, rgba(255,255,255,0.18) 35%, transparent 65%)`,
          }}
        />

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div
          className="relative px-4 py-4 flex-shrink-0"
          style={{ borderBottom: collapsed ? "none" : `1px solid ${epic.color}15` }}
        >
          {/* Gloss overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(155deg, rgba(255,255,255,0.025) 0%, transparent 50%)`,
            }}
          />

          <div className="relative flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {/* Pulsing orb */}
                <div className="relative shrink-0 mt-0.5">
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: epic.color,
                      boxShadow: `0 0 8px ${epic.color}, 0 0 16px ${epic.color}60`,
                    }}
                    animate={hovered ? { scale: [1, 1.25, 1] } : {}}
                    transition={{ duration: 1.8, repeat: hovered ? Infinity : 0 }}
                  />
                </div>

                <h3
                  className="text-sm font-semibold truncate flex-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {epic.title}
                </h3>

                {/* Collapse toggle */}
                <motion.button
                  onClick={toggleCollapsed}
                  className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  whileHover={{
                    background: `${epic.color}18`,
                    color: epic.color,
                  }}
                  whileTap={{ scale: 0.88 }}
                  title={collapsed ? "Развернуть" : "Свернуть"}
                >
                  <ChevronIcon collapsed={collapsed} />
                </motion.button>
              </div>

              {/* Progress bar */}
              <div
                className="relative h-1 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <motion.div
                  className="h-full rounded-full relative overflow-hidden"
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    backgroundColor: epic.color,
                    boxShadow: `0 0 6px ${epic.color}80`,
                  }}
                >
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.45) 50%, transparent 75%)",
                    }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      repeatDelay: 0.8,
                    }}
                  />
                </motion.div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: epic.color, fontWeight: 700 }}>
                    {epic.progress.done}
                  </span>
                  <span style={{ opacity: 0.4 }}>/{epic.progress.total}</span>
                </span>
                {pct === 100 && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-[10px] font-semibold"
                    style={{ color: "#34d399" }}
                  >
                    ✦ Готово
                  </motion.span>
                )}
              </div>
            </div>

            {/* Right: task count + ring */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <motion.span
                key={visibleTasks.length}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="text-xs font-mono px-1.5 py-0.5 rounded-md"
                style={{
                  background: `${epic.color}18`,
                  color: epic.color,
                  border: `1px solid ${epic.color}28`,
                }}
              >
                {visibleTasks.length}
              </motion.span>
              <ProgressRing pct={pct} color={epic.color} />
            </div>
          </div>
        </div>

        {/* ── COLLAPSED SUMMARY ──────────────────────────────────── */}
        <AnimatePresence>
          {collapsed && (
            <CollapsedSummary byStatus={byStatus} color={epic.color} />
          )}
        </AnimatePresence>

        {/* ── BODY ────────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div
                className="relative flex-1 overflow-y-auto p-3 space-y-3"
                style={{ minHeight: 80 }}
              >
                {STATUS_ORDER.map((status, sIdx) => {
                  const tasks = byStatus[status];
                  if (!tasks.length && status === "blocked") return null;
                  const meta = STATUS_META[status];
                  const isDropActive =
                    dragState.overStatus === status && dragState.draggingId !== null;

                  return (
                    <motion.div
                      key={status}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: sIdx * 0.05 }}
                    >
                      <StatusLabel status={status} count={tasks.length} meta={meta} />

                      <div {...getDropProps(status)}>
                        <DropZone isActive={isDropActive} color={epic.color}>
                          <AnimatePresence mode="popLayout">
                            {tasks.map((task, tIdx) => {
                              const dProps = getDragProps(task.id);
                              return (
                                <div
                                  key={task.id}
                                  draggable
                                  data-dragging={dProps["data-dragging"]}
                                  onDragStart={dProps.onDragStart}
                                  onDragEnd={dProps.onDragEnd}
                                >
                                  <motion.div
                                    layout
                                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.94, y: -4 }}
                                    transition={{ duration: 0.22, delay: tIdx * 0.03 }}
                                    style={
                                      focusedTaskId === task.id
                                        ? {
                                            borderRadius: 12,
                                            outline: `2px solid ${epic.color}70`,
                                            outlineOffset: 2,
                                          }
                                        : {}
                                    }
                                  >
                                    <TaskCard
                                      task={task}
                                      onOpen={onOpenTask}
                                      isFocused={focusedTaskId === task.id}
                                    />
                                  </motion.div>
                                </div>
                              );
                            })}
                          </AnimatePresence>

                          {!tasks.length && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.1 }}
                              className="flex flex-col items-center py-4 gap-1.5"
                            >
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center"
                                style={{
                                  background: meta.bg,
                                  border: `1px dashed ${meta.border}`,
                                }}
                              >
                                <svg
                                  className="w-3 h-3"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                  stroke={meta.color}
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                >
                                  <path d="M6 2v8M2 6h8" />
                                </svg>
                              </div>
                              <p
                                className="text-[10px]"
                                style={{ color: "var(--text-muted)", opacity: 0.7 }}
                              >
                                Пусто
                              </p>
                            </motion.div>
                          )}
                        </DropZone>
                      </div>
                    </motion.div>
                  );
                })}

                <QuickAddTask epicId={epic.id} epicColor={epic.color} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}