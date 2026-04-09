"use client";
/**
 * @file TaskSlideover.tsx — features/task-details
 *
 * ИСПРАВЛЕНИЕ v4 (light-theme):
 *   - Панель slideover уже использует var(--modal-bg) и var(--modal-backdrop) ✅
 *   - Убраны последние hardcoded rgba(255,255,255,x) для интерактивных элементов
 *   - kbd-элементы используют CSS vars
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useBodyScrollLock } from "@/shared/lib/hooks/useBodyScrollLock";
import { SubtaskList } from "./SubtaskList";
import { AssigneeManager } from "@/shared/ui/AssigneeManager";
import { formatDate, formatDateInput } from "@/shared/lib/utils";
import { STATUS_META, PRIORITY_META } from "@/shared/config/task-meta";
import type { TaskStatus, TaskPriority, TaskView, UserWithMeta } from "@/shared/types";

export interface TaskSlideoverProps {
  task:     TaskView | null;
  isOpen?:  boolean;
  onClose:  () => void;
}

/* ── UI constants ──────────────────────────────────────────────────────────── */
const STATUS_OPTIONS:   TaskStatus[]   = ["todo", "in_progress", "done", "blocked"];
const PRIORITY_OPTIONS: TaskPriority[] = ["critical", "high", "medium", "low"];

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        "К работе",
  in_progress: "В работе",
  done:        "Готово",
  blocked:     "Заблокировано",
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
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--glass-border)" }} />
    </div>
  );
}

/* ── Inline editable title ─────────────────────────────────────────────────── */
function InlineTitle({
  value,
  isDone,
  onSave,
}: {
  value:   string;
  isDone:  boolean;
  onSave:  (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);

  const save = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        maxLength={200}
        className="w-full text-base font-semibold leading-snug bg-[var(--glass-01)] border border-[var(--accent-500)] rounded-lg px-2 py-1 outline-none"
        style={{ color: "var(--text-primary)" }}
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="w-full text-left group flex items-start gap-1"
      title="Нажмите для редактирования"
    >
      <span
        className="text-base font-semibold leading-snug"
        style={{
          color:          isDone ? "var(--text-muted)" : "var(--text-primary)",
          textDecoration: isDone ? "line-through" : "none",
          textDecorationColor: "rgba(52,211,153,0.45)",
        }}
      >
        {value}
      </span>
      <span className="shrink-0 opacity-0 group-hover:opacity-40 text-xs mt-1">✎</span>
    </button>
  );
}

/* ── Inline editable description ───────────────────────────────────────────── */
function InlineDescription({
  value,
  onSave,
}: {
  value:  string | null | undefined;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value ?? "");

  const save = () => {
    setEditing(false);
    const v = draft.trim() || null;
    if (v !== (value ?? null)) onSave(v);
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        rows={4}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
        placeholder="Добавить описание..."
        maxLength={2000}
        className="w-full text-sm bg-[var(--glass-01)] border border-[var(--accent-500)] rounded-lg px-3 py-2 outline-none resize-none leading-relaxed"
        style={{ color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="w-full text-left group flex items-start gap-1"
    >
      <span
        className="text-sm leading-relaxed flex-1"
        style={{ color: value ? "var(--text-secondary)" : "var(--text-muted)" }}
      >
        {value || "Добавить описание..."}
      </span>
      <span className="shrink-0 opacity-0 group-hover:opacity-40 text-xs mt-0.5">✎</span>
    </button>
  );
}

/* ── Users fetcher (lazy) ──────────────────────────────────────────────────── */
function useUsers() {
  const [users, setUsers] = useState<UserWithMeta[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => { if (d.data) setUsers(d.data); })
      .catch(() => {});
  }, []);

  return users;
}

/* ── Main Component ────────────────────────────────────────────────────────── */
export function TaskSlideover({ task, isOpen: isOpenProp, onClose }: TaskSlideoverProps) {
  const isOpen = isOpenProp ?? task !== null;
  const panelRef = useRef<HTMLDivElement>(null);

  const updateTaskStatus      = useTaskStore((s) => s.updateTaskStatus);
  const updateTaskPriority    = useTaskStore((s) => s.updateTaskPriority);
  const updateTaskTitle       = useTaskStore((s) => s.updateTaskTitle);
  const updateTaskDescription = useTaskStore((s) => s.updateTaskDescription);
  const updateTaskDueDate     = useTaskStore((s) => s.updateTaskDueDate);

  const liveTask = useTaskStore((s) => (task ? s.getTask(task.id) : null)) ?? task;

  const epicColor = useTaskStore((s) => {
    if (!liveTask) return "#7c3aed";
    const epic = s.epics.find((e) => e.id === liveTask.epicId);
    return epic?.color ?? "#7c3aed";
  });

  const users = useUsers();
  const isDone = liveTask?.status === "done";

  const handleQuickDone = useCallback(() => {
    if (!liveTask) return;
    updateTaskStatus(liveTask.id, isDone ? "todo" : "done");
  }, [liveTask, isDone, updateTaskStatus]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useBodyScrollLock(isOpen);

  return (
    <AnimatePresence>
      {isOpen && liveTask && (
        <>
          {/* Backdrop — var(--modal-backdrop) адаптируется к теме */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40"
            variants={backdropVariants}
            initial="hidden" animate="visible" exit="exit"
            style={{
              background: "var(--modal-backdrop)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
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
                width:      "clamp(360px, 42vw, 520px)",
                background: "var(--modal-bg)",
                borderLeft: `1px solid ${epicColor}25`,
                boxShadow:  `-24px 0 64px rgba(0,0,0,0.3), 0 0 0 1px ${epicColor}15`,
                transformStyle: "preserve-3d",
              }}
            >
              {/* Top accent line */}
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
                  <InlineTitle
                    value={liveTask.title}
                    isDone={isDone}
                    onSave={(v) => updateTaskTitle(liveTask.id, v)}
                  />
                </div>

                {/* Quick done button */}
                <motion.button
                  onClick={handleQuickDone}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={isDone ? {
                    background:   "rgba(52,211,153,0.15)",
                    border:       "1px solid rgba(52,211,153,0.35)",
                    color:        "#34d399",
                  } : {
                    background:   `${epicColor}18`,
                    border:       `1px solid ${epicColor}35`,
                    color:        epicColor,
                  }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  {isDone ? (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M2 7l4 4 6-6" />
                      </svg>
                      Готово
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M2 7l4 4 6-6" />
                      </svg>
                      Выполнить
                    </>
                  )}
                </motion.button>

                <button
                  onClick={onClose}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: "var(--glass-02)",
                    border:     "1px solid var(--glass-border)",
                    color:      "var(--text-muted)",
                    cursor:     "pointer",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

                {/* Description */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                  <SectionHeader label="Описание" />
                  <InlineDescription
                    value={liveTask.description}
                    onSave={(v) => updateTaskDescription(liveTask.id, v)}
                  />
                </motion.div>

                {/* Status */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                  <SectionHeader label="Статус" />
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map((s) => {
                      const meta   = STATUS_META[s];
                      const active = liveTask.status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => updateTaskStatus(liveTask.id, s)}
                          style={{
                            padding:      "4px 12px",
                            borderRadius: 99,
                            fontSize:     11,
                            fontWeight:   500,
                            cursor:       "pointer",
                            outline:      "none",
                            transition:   "all 0.2s ease",
                            background:   active ? meta.bg      : "var(--glass-01)",
                            color:        active ? meta.color   : "var(--text-muted)",
                            border:       `1px solid ${active ? meta.color + "40" : "var(--glass-border)"}`,
                            boxShadow:    active ? `0 0 10px ${meta.color}20` : "none",
                          }}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Priority */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <SectionHeader label="Приоритет" />
                  <div className="flex flex-wrap gap-2">
                    {PRIORITY_OPTIONS.map((p) => {
                      const meta   = PRIORITY_META[p];
                      const active = liveTask.priority === p;
                      return (
                        <button
                          key={p}
                          onClick={() => updateTaskPriority(liveTask.id, p)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{
                            cursor:      "pointer",
                            outline:     "none",
                            transition:  "all 0.2s ease",
                            background:  active ? `${meta.color}20`        : "var(--glass-01)",
                            color:       active ? meta.color               : "var(--text-muted)",
                            border:      `1px solid ${active ? meta.color + "40" : "var(--glass-border)"}`,
                            boxShadow:   active ? `0 0 12px ${meta.color}20` : "none",
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Due date */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                  <SectionHeader label="Дедлайн" />
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      value={formatDateInput(liveTask.dueDate)}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateTaskDueDate(liveTask.id, val ? `${val}T00:00:00.000Z` : null);
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm outline-none transition-all"
                      style={{
                        background:   "var(--glass-01)",
                        border:       "1px solid var(--glass-border)",
                        color:        liveTask.dueDate ? "var(--text-primary)" : "var(--text-muted)",
                        colorScheme:  "light dark",
                      }}
                    />
                    {liveTask.dueDate && (
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        {formatDate(liveTask.dueDate)}
                      </span>
                    )}
                    {liveTask.dueDate && (
                      <button
                        onClick={() => updateTaskDueDate(liveTask.id, null)}
                        className="text-xs transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        title="Снять дедлайн"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </motion.div>

                {/* Subtasks */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                  <SectionHeader
                    label={`Подзадачи ${liveTask.subtasks.length > 0 ? `(${liveTask.subtasks.filter((s) => s.isCompleted).length}/${liveTask.subtasks.length})` : ""}`}
                  />
                  <SubtaskList taskId={liveTask.id} subtasks={liveTask.subtasks} />
                </motion.div>

                {/* Assignees */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
                  <SectionHeader label={`Исполнители (${liveTask.assignees.length})`} />
                  <AssigneeManager
                    taskId={liveTask.id}
                    assignees={liveTask.assignees}
                    users={users}
                  />
                </motion.div>

                {/* Meta */}
                <motion.div
                  className="flex flex-wrap gap-x-5 gap-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Создана</span>
                    <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                      {new Date(liveTask.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  {liveTask.updatedAt && liveTask.updatedAt !== liveTask.createdAt && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Обновлена</span>
                      <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                        {new Date(liveTask.updatedAt).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                  )}
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
                    border:     "1px solid var(--glass-border)",
                    color:      "var(--text-secondary)",
                    cursor:     "pointer",
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