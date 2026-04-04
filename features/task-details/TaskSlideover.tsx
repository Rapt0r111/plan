"use client";
/**
 * @file TaskSlideover.tsx — features/task-details
 *
 * OFFLINE GUARD v2:
 *   - Статус и приоритет недоступны при офлайн
 *   - Кнопки визуально задисейблены (opacity + cursor) и не кликабельны
 *   - Показывается маленький индикатор «Только просмотр» в хедере
 *   - Подзадачи: просмотр разрешён, toggle заблокирован
 */
import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useBodyScrollLock } from "@/shared/lib/hooks/useBodyScrollLock";
import { useIsOffline } from "@/shared/lib/hooks/useIsOffline";
import { SubtaskList } from "./SubtaskList";
import { formatDate } from "@/shared/lib/utils";
import type { TaskStatus, TaskPriority, TaskView } from "@/shared/types";

export interface TaskSlideoverProps {
  task: TaskView | null;
  isOpen?: boolean;
  onClose: () => void;
}

/* ── UI constants ──────────────────────────────────────────────────────────── */
const STATUS_OPTIONS: TaskStatus[]     = ["todo", "in_progress", "done", "blocked"];
const PRIORITY_OPTIONS: TaskPriority[] = ["critical", "high", "medium", "low"];

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        "К работе",
  in_progress: "В работе",
  done:        "Готово",
  blocked:     "Заблокировано",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo:        "var(--status-todo-text)",
  in_progress: "var(--status-progress-text)",
  done:        "var(--status-done-text)",
  blocked:     "var(--status-blocked-text)",
};

const STATUS_BG: Record<TaskStatus, string> = {
  todo:        "var(--status-todo-bg)",
  in_progress: "var(--status-progress-bg)",
  done:        "var(--status-done-bg)",
  blocked:     "var(--status-blocked-bg)",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: "var(--priority-critical)",
  high:     "var(--priority-high)",
  medium:   "var(--priority-medium)",
  low:      "var(--priority-low)",
};

/* ── Animation variants ────────────────────────────────────────────────────── */
const panelVariants = {
  hidden:  { x: "100%", rotateY: 8, opacity: 0 },
  visible: {
    x: "0%", rotateY: 0, opacity: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 28, mass: 0.9 },
  },
  exit: {
    x: "100%", rotateY: 6, opacity: 0,
    transition: { duration: 0.28, ease: [0.4, 0, 1, 1] as const },
  },
};

const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};

/* ── Section Header ────────────────────────────────────────────────────────── */
function SectionHeader({ label, readOnly }: { label: string; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {readOnly && (
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
          style={{ background: "rgba(100,116,139,0.15)", color: "var(--text-muted)" }}
        >
          🔒 офлайн
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: "var(--glass-border)" }} />
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────────── */
export function TaskSlideover({ task, isOpen: isOpenProp, onClose }: TaskSlideoverProps) {
  const isOpen = isOpenProp ?? task !== null;
  const panelRef = useRef<HTMLDivElement>(null);
  const offline = useIsOffline();

  const updateTaskStatus   = useTaskStore((s) => s.updateTaskStatus);
  const updateTaskPriority = useTaskStore((s) => s.updateTaskPriority);
  const liveTask = useTaskStore((s) => (task ? s.getTask(task.id) : null)) ?? task;

  const epicColor = useTaskStore((s) => {
    if (!liveTask) return "#7c3aed";
    const epic = s.epics.find((e) => e.id === liveTask.epicId);
    return epic?.color ?? "#7c3aed";
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useBodyScrollLock(isOpen);

  return (
    <AnimatePresence>
      {isOpen && liveTask && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40"
            variants={backdropVariants}
            initial="hidden" animate="visible" exit="exit"
            style={{ background: "var(--modal-backdrop)", backdropFilter: "blur(2px)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <div
            className="fixed inset-y-0 right-0 z-50 flex items-stretch"
            style={{ perspective: "1200px", perspectiveOrigin: "right center" }}
          >
            <motion.div
              ref={panelRef}
              key="panel"
              className="relative flex flex-col overflow-hidden"
              variants={panelVariants}
              initial="hidden" animate="visible" exit="exit"
              style={{
                width: "clamp(360px, 42vw, 520px)",
                background: "var(--modal-bg)",
                borderLeft: `1px solid ${epicColor}25`,
                boxShadow: `-24px 0 64px rgba(0,0,0,0.6), 0 0 0 1px ${epicColor}15`,
                transformStyle: "preserve-3d",
              }}
            >
              {/* Top color line */}
              <div
                className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                style={{ background: `linear-gradient(90deg, ${epicColor} 0%, transparent 60%)` }}
              />

              {/* ── Header ── */}
              <div
                className="relative flex items-start gap-3 px-5 pt-5 pb-4 shrink-0"
                style={{ borderBottom: "1px solid var(--glass-border)" }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                  style={{ background: epicColor, boxShadow: `0 0 8px ${epicColor}80` }}
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                    {liveTask.title}
                  </h2>
                  {/* Read-only badge when offline */}
                  {offline && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 mt-1.5"
                    >
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          background: "rgba(234,179,8,0.12)",
                          border:     "1px solid rgba(234,179,8,0.25)",
                          color:      "#eab308",
                        }}
                      >
                        <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <rect x="2" y="5.5" width="8" height="6" rx="1.2" />
                          <path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" />
                        </svg>
                        Только просмотр
                      </span>
                    </motion.div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: "var(--glass-02)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

                {/* Status */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                  <SectionHeader label="Статус" readOnly={offline} />
                  <div className="flex flex-wrap gap-1.5" style={{ opacity: offline ? 0.6 : 1 }}>
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={offline ? undefined : () => updateTaskStatus(liveTask.id, s)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: offline ? "not-allowed" : "pointer",
                          outline: "none",
                          transition: "all 0.2s ease",
                          background:  liveTask.status === s ? STATUS_BG[s]     : "var(--glass-01)",
                          color:       liveTask.status === s ? STATUS_COLORS[s] : "var(--text-muted)",
                          border:      `1px solid ${liveTask.status === s ? STATUS_COLORS[s] + "40" : "var(--glass-border)"}`,
                        }}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Priority */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                  <SectionHeader label="Приоритет" readOnly={offline} />
                  <div className="flex flex-wrap gap-2" style={{ opacity: offline ? 0.6 : 1 }}>
                    {PRIORITY_OPTIONS.map((p) => (
                      <button
                        key={p}
                        onClick={offline ? undefined : () => updateTaskPriority(liveTask.id, p)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                        style={{
                          cursor: offline ? "not-allowed" : "pointer",
                          outline: "none",
                          transition: "all 0.2s ease",
                          background:  liveTask.priority === p ? PRIORITY_COLORS[p] + "20" : "var(--glass-01)",
                          color:       liveTask.priority === p ? PRIORITY_COLORS[p]        : "var(--text-muted)",
                          border:      `1px solid ${liveTask.priority === p ? PRIORITY_COLORS[p] + "40" : "var(--glass-border)"}`,
                          boxShadow:   liveTask.priority === p ? `0 0 12px ${PRIORITY_COLORS[p]}20` : "none",
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_COLORS[p] }} />
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Description */}
                {liveTask.description && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <SectionHeader label="Описание" />
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {liveTask.description}
                    </p>
                  </motion.div>
                )}

                {/* Subtasks — viewing allowed, toggling blocked offline */}
                {liveTask.subtasks.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <SectionHeader
                      label={`Подзадачи (${liveTask.subtasks.filter((s) => s.isCompleted).length}/${liveTask.subtasks.length})`}
                      readOnly={offline}
                    />
                    <SubtaskList taskId={liveTask.id} subtasks={liveTask.subtasks} />
                  </motion.div>
                )}

                {/* Assignees */}
                {liveTask.assignees.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
                    <SectionHeader label="Исполнители" />
                    <div className="flex items-center gap-2 flex-wrap">
                      {liveTask.assignees.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                          style={{ background: `${a.roleMeta.hex}15`, border: `1px solid ${a.roleMeta.hex}25` }}
                        >
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                            style={{ backgroundColor: a.roleMeta.hex }}
                          >
                            {a.initials}
                          </div>
                          <span className="text-xs" style={{ color: a.roleMeta.hex }}>{a.roleMeta.short}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Meta */}
                <motion.div
                  className="flex flex-wrap gap-x-5 gap-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.24 }}
                >
                  {liveTask.dueDate && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Срок</span>
                      <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                        {formatDate(liveTask.dueDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Создана</span>
                    <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                      {new Date(liveTask.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* ── Footer ── */}
              <div
                className="shrink-0 px-5 py-3 flex items-center justify-between"
                style={{ borderTop: "1px solid var(--glass-border)" }}
              >
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  #{String(liveTask.id).padStart(4, "0")}
                </span>
                <button
                  onClick={onClose}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{
                    background: "var(--glass-02)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Закрыть{" "}
                  <kbd className="text-xs font-mono opacity-60 ml-1">Esc</kbd>
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}