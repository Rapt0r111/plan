"use client";
/**
 * PATH:    features/task-details/TaskSlideover.tsx   ← заменить существующий файл
 * CONNECT: app/(main)/board/BoardPage.tsx — там уже импортируется TaskSlideover.
 *          Импорт не меняется — путь тот же.
 *
 *          Новые пропы которые принимает обновлённый компонент:
 *
 *   <TaskSlideover
 *     task={selectedTask}              // TaskDetail | null
 *     isOpen={!!selectedTask}
 *     onClose={() => setSelectedTask(null)}
 *     onStatusChange={(id, status) => updateTask(id, { status })}
 *     onPriorityChange={(id, priority) => updateTask(id, { priority })}
 *   />
 *
 * ── Типы ─────────────────────────────────────────────────────────────────────
 *   TaskStatus, TaskPriority, SubtaskView — из @/shared/types.
 *   TaskDetail расширяет DbTask — id здесь number (как в schema).
 *   epicColor и epicName — дополнительные поля, подмешиваются при открытии
 *   slideover в BoardPage.tsx (см. INTEGRATION.md, шаг [5]).
 *
 * ── Изменения относительно оригинала ─────────────────────────────────────────
 *   - subtasks: SubtaskView[] вместо кастомного Array<{id:string; ...}>
 *     SubtaskView.id — number (как в schema), done — boolean из DbSubtask
 *   - id типа number, приводится к string только для отображения (#id)
 *   - Все TaskStatus / TaskPriority — из shared/types, без локального override
 */

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  TaskStatus,
  TaskPriority,
  SubtaskView,
  DbTask,
} from "@/shared/types";

/* ── TaskDetail — то что приходит в slideover ──────────────────────────────── */
// Расширяем DbTask (реальные поля из schema) и подмешиваем UI-поля
export interface TaskDetail extends DbTask {
  // Из schema: id (number), title, status, priority, description, dueDate, epicId, ...
  // UI-поля, подмешиваемые в BoardPage.tsx при открытии:
  epicName?:  string;
  epicColor?: string;
  // Обогащённые данные из taskRepository / useTaskStore:
  assigneeNames?: string[];   // имена исполнителей (уже строки, не объекты)
  subtasks?:      SubtaskView[];
  comments?:      Array<{ author: string; text: string; date: string }>;
  tags?:          string[];
}

interface TaskSlideoverProps {
  task:              TaskDetail | null;
  isOpen:            boolean;
  onClose:           () => void;
  onStatusChange?:   (id: number, status: TaskStatus) => void;
  onPriorityChange?: (id: number, priority: TaskPriority) => void;
}

/* ── UI constants ──────────────────────────────────────────────────────────── */
const STATUS_OPTIONS: TaskStatus[]    = ["todo", "in-progress", "done", "blocked"];
const PRIORITY_OPTIONS: TaskPriority[] = ["critical", "high", "medium", "low"];

const STATUS_LABELS: Record<TaskStatus, string> = {
  "todo":        "To Do",
  "in-progress": "In Progress",
  "done":        "Done",
  "blocked":     "Blocked",
};
const STATUS_COLORS: Record<TaskStatus, string> = {
  "todo":        "var(--status-todo-text)",
  "in-progress": "var(--status-progress-text)",
  "done":        "var(--status-done-text)",
  "blocked":     "var(--status-blocked-text)",
};
const STATUS_BG: Record<TaskStatus, string> = {
  "todo":        "var(--status-todo-bg)",
  "in-progress": "var(--status-progress-bg)",
  "done":        "var(--status-done-bg)",
  "blocked":     "var(--status-blocked-bg)",
};
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: "var(--priority-critical)",
  high:     "var(--priority-high)",
  medium:   "var(--priority-medium)",
  low:      "var(--priority-low)",
};

/* ── Animation variants ────────────────────────────────────────────────────── */
// Spatial entry: разворачивается из пространства за экраном
const panelVariants = {
  hidden:  { x: "100%", rotateY: 8,  opacity: 0 },
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
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--glass-border)" }} />
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────────── */
export function TaskSlideover({
  task, isOpen, onClose, onStatusChange, onPriorityChange,
}: TaskSlideoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Закрытие по Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Блокировка скролла body
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const epicColor = task?.epicColor ?? "#7c3aed";

  return (
    <AnimatePresence>
      {isOpen && task && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ background: "var(--modal-backdrop)", backdropFilter: "blur(2px)" }}
            onClick={onClose}
          />

          {/* Perspective wrapper — создаёт 3D-пространство для spatial entry */}
          <div
            className="fixed inset-y-0 right-0 z-50 flex items-stretch"
            style={{ perspective: "1200px", perspectiveOrigin: "right center" }}
          >
            <motion.div
              ref={panelRef}
              key="panel"
              className="relative flex flex-col overflow-hidden"
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                width: "clamp(360px, 42vw, 520px)",
                background: "var(--modal-bg)",
                borderLeft: `1px solid ${epicColor}25`,
                boxShadow: `-24px 0 64px rgba(0,0,0,0.6), 0 0 0 1px ${epicColor}15`,
                transformStyle: "preserve-3d",
              }}
            >
              {/* Epic color — линия сверху */}
              <div
                className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                style={{ background: `linear-gradient(90deg, ${epicColor} 0%, transparent 60%)` }}
              />
              {/* Chromatic aberration */}
              <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                  background: `
                    linear-gradient(160deg, rgba(255,80,80,0.012) 0%, transparent 30%),
                    linear-gradient(200deg, rgba(80,140,255,0.015) 0%, transparent 30%)
                  `,
                }}
              />

              {/* ── Header ── */}
              <div
                className="relative flex items-start gap-3 px-5 pt-5 pb-4 flex-shrink-0"
                style={{ borderBottom: "1px solid var(--glass-border)" }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: epicColor, boxShadow: `0 0 8px ${epicColor}80` }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-1" style={{ color: epicColor }}>
                    {task.epicName ?? "Task"}
                  </p>
                  <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                    {task.title}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: "var(--glass-02)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--glass-03)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--glass-02)")}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

                {/* Статус */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SectionHeader label="Status" />
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => onStatusChange?.(task.id, s)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: "pointer",
                          outline: "none",
                          transition: "all 0.2s ease",
                          background: task.status === s ? STATUS_BG[s]    : "var(--glass-01)",
                          color:      task.status === s ? STATUS_COLORS[s] : "var(--text-muted)",
                          border:     `1px solid ${task.status === s ? STATUS_COLORS[s] + "40" : "var(--glass-border)"}`,
                        }}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Приоритет */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SectionHeader label="Priority" />
                  <div className="flex flex-wrap gap-2">
                    {PRIORITY_OPTIONS.map((p) => (
                      <button
                        key={p}
                        onClick={() => onPriorityChange?.(task.id, p)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                        style={{
                          cursor: "pointer",
                          outline: "none",
                          transition: "all 0.2s ease",
                          background:  task.priority === p ? PRIORITY_COLORS[p] + "20" : "var(--glass-01)",
                          color:       task.priority === p ? PRIORITY_COLORS[p]        : "var(--text-muted)",
                          border:      `1px solid ${task.priority === p ? PRIORITY_COLORS[p] + "40" : "var(--glass-border)"}`,
                          boxShadow:   task.priority === p ? `0 0 12px ${PRIORITY_COLORS[p]}20` : "none",
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: PRIORITY_COLORS[p] }}
                        />
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Описание */}
                {task.description && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <SectionHeader label="Description" />
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {task.description}
                    </p>
                  </motion.div>
                )}

                {/* Подзадачи — SubtaskView из shared/types */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <SectionHeader
                      label={`Subtasks (${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length})`}
                    />
                    <div className="flex flex-col gap-1.5">
                      {task.subtasks.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                          style={{
                            background: "var(--glass-01)",
                            border: "1px solid var(--glass-border)",
                          }}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
                            style={{
                              background: sub.done ? "var(--color-done)" : "var(--glass-02)",
                              border: `1px solid ${sub.done ? "var(--color-done)" : "var(--glass-border)"}`,
                            }}
                          >
                            {sub.done && (
                              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span
                            className="text-xs flex-1"
                            style={{
                              color:          sub.done ? "var(--text-muted)" : "var(--text-secondary)",
                              textDecoration: sub.done ? "line-through" : "none",
                            }}
                          >
                            {sub.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Теги */}
                {task.tags && task.tags.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.21, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <SectionHeader label="Tags" />
                    <div className="flex flex-wrap gap-1.5">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: epicColor + "18",
                            color: epicColor,
                            border: `1px solid ${epicColor}30`,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Метаданные */}
                <motion.div
                  className="flex flex-wrap gap-x-5 gap-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.24 }}
                >
                  {/* Исполнители */}
                  {task.assigneeNames && task.assigneeNames.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {task.assigneeNames.length === 1 ? "Assignee" : "Assignees"}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {task.assigneeNames.map((name) => (
                          <div key={name} className="flex items-center gap-1">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center font-semibold"
                              style={{ background: epicColor + "30", color: epicColor, fontSize: 9 }}
                            >
                              {name[0].toUpperCase()}
                            </span>
                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              {name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {task.dueDate && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Due date</span>
                      <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                        {task.dueDate}
                      </span>
                    </div>
                  )}

                  {task.createdAt && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Created</span>
                      <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                        {new Date(task.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </motion.div>

                {/* Комментарии */}
                {task.comments && task.comments.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.27, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <SectionHeader label="Comments" />
                    <div className="flex flex-col gap-2">
                      {task.comments.map((c, i) => (
                        <div
                          key={i}
                          className="px-3 py-2.5 rounded-xl"
                          style={{
                            background: "var(--glass-01)",
                            border: "1px solid var(--glass-border)",
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                              {c.author}
                            </span>
                            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                              {c.date}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {c.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ── Footer ── */}
              <div
                className="flex-shrink-0 px-5 py-3 flex items-center justify-between"
                style={{ borderTop: "1px solid var(--glass-border)" }}
              >
                {/* id — number в schema, показываем как строку */}
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  #{String(task.id).padStart(4, "0")}
                </span>
                <button
                  onClick={onClose}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{
                    background: "var(--glass-02)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    outline: "none",
                    transition: "background 0.15s ease",
                  }}
                >
                  Close{" "}
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