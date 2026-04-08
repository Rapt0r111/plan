"use client";
/**
 * @file EpicWorkspace.tsx — features/epics
 *
 * LIGHT THEME FIX v4:
 *   Replaced hardcoded `rgba(4,5,10,0.78)` backdrop with `var(--modal-backdrop)`.
 *   The CSS variable resolves to the correct value for both dark and light themes.
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useSpring,
} from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatDate } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { STATUS_META, STATUS_ORDER } from "@/shared/config/task-meta";
import type { EpicSummary, EpicWithTasks, TaskView, TaskStatus } from "@/shared/types";
import { useBodyScrollLock } from "@/shared/lib/hooks/useBodyScrollLock";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING = { type: "spring" as const, stiffness: 500, damping: 38, mass: 0.4 };

// ── Task Row ──────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: TaskView;
  epicColor: string;
  onOpen: (task: TaskView) => void;
}

function TaskRow({ task, epicColor, onOpen }: TaskRowProps) {
  const liveTask = useTaskStore((s) => s.getTask(task.id)) ?? task;
  const updateStatus = useTaskStore((s) => s.updateTaskStatus);
  const sm = STATUS_META[liveTask.status];

  const subtaskCount = liveTask.subtasks?.length ?? 0;
  const subtaskDone = liveTask.subtasks?.filter((s) => s.isCompleted).length ?? 0;
  const progress = subtaskCount > 0 ? subtaskDone / subtaskCount : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
      style={{
        background: "var(--bg-overlay)",
        border: "0.5px solid var(--glass-border)",
      }}
      whileHover={{
        background: `${epicColor}08`,
        borderColor: `${epicColor}25`,
      }}
      onClick={() => onOpen(liveTask)}
    >
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ backgroundColor: epicColor, opacity: 0.5 }}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          const cycle: TaskStatus[] = ["todo", "in_progress", "done"];
          const idx = cycle.indexOf(liveTask.status as TaskStatus);
          updateStatus(liveTask.id, cycle[(idx + 1) % cycle.length]);
        }}
        className="shrink-0 mt-0.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
        style={{ background: sm.bg, color: sm.color, border: `0.5px solid ${sm.border}` }}
      >
        <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: sm.solid }} />
        {sm.label}
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium leading-snug",
            liveTask.status === "done" && "line-through opacity-50",
          )}
          style={{ color: "var(--text-primary)" }}
        >
          {liveTask.title}
        </p>

        {liveTask.description && (
          <p className="text-xs mt-0.5 line-clamp-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {liveTask.description}
          </p>
        )}

        {subtaskCount > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <div
              className="flex-1 max-w-[80px] h-0.5 rounded-full overflow-hidden"
              style={{ background: "var(--glass-02)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: epicColor }}
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
              {subtaskDone}/{subtaskCount}
            </span>
          </div>
        )}
      </div>

      {liveTask.assignees && liveTask.assignees.length > 0 && (
        <div className="flex items-center -space-x-1.5 shrink-0">
          {liveTask.assignees.slice(0, 3).map((a, i) => (
            <div
              key={a.id}
              title={a.name}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-1 ring-[var(--bg-overlay)] shrink-0"
              style={{ backgroundColor: a.roleMeta.hex, zIndex: 3 - i }}
            >
              {a.initials}
            </div>
          ))}
        </div>
      )}

      {liveTask.dueDate && (
        <span className="shrink-0 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {formatDate(liveTask.dueDate)}
        </span>
      )}
    </motion.div>
  );
}

// ── Status Section ────────────────────────────────────────────────────────────

function StatusSection({
  status,
  tasks,
  epicColor,
  onOpenTask,
}: {
  status: TaskStatus;
  tasks: TaskView[];
  epicColor: string;
  onOpenTask: (t: TaskView) => void;
}) {
  const sm = STATUS_META[status];
  if (!tasks.length && status === "blocked") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
          style={{ background: sm.bg, color: sm.color, borderColor: sm.border }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sm.solid }} />
          {sm.label}
        </div>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {tasks.length}
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--glass-border)" }} />
      </div>

      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} epicColor={epicColor} onOpen={onOpenTask} />
          ))}
        </AnimatePresence>
        {!tasks.length && (
          <p className="text-xs py-1.5 pl-1" style={{ color: "var(--text-muted)" }}>
            Нет задач
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function WorkspaceSkeleton({ color }: { color: string }) {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-5 w-28 rounded-full" style={{ background: `${color}18` }} />
          {[...Array(2 - (i % 2))].map((_, j) => (
            <div
              key={j}
              className="h-12 rounded-xl"
              style={{ background: "var(--glass-01)", opacity: 0.7 - j * 0.15 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Workspace ─────────────────────────────────────────────────────────────────

interface EpicWorkspaceProps {
  epicId: number;
  summary: EpicSummary;
  onClose: () => void;
  onOpenTask: (task: TaskView) => void;
}

export function EpicWorkspace({ epicId, summary, onClose, onOpenTask }: EpicWorkspaceProps) {
  const [fullEpic, setFullEpic] = useState<EpicWithTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ignore = false;

    fetch(`/api/epics/${epicId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!ignore && d.ok) setFullEpic(d.data);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => { ignore = true; };
  }, [epicId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useBodyScrollLock(true);

  const progress = summary.taskCount > 0 ? summary.doneCount / summary.taskCount : 0;
  const pct = Math.round(progress * 100);

  const byStatus = fullEpic
    ? STATUS_ORDER.reduce<Record<TaskStatus, TaskView[]>>(
        (acc, s) => {
          acc[s] = fullEpic.tasks.filter((t) => t.status === s);
          return acc;
        },
        { in_progress: [], todo: [], blocked: [], done: [] },
      )
    : null;

  const animPct = useSpring(0, { stiffness: 80, damping: 20 });
  useEffect(() => { animPct.set(pct); }, [pct, animPct]);

  return (
    <>
      {/* ── Backdrop — FIXED: use var(--modal-backdrop) for light/dark ── */}
      <motion.div
        key="ws-backdrop"
        className="fixed inset-0"
        style={{ zIndex: 58, pointerEvents: "auto", cursor: "default" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "var(--modal-backdrop)",
            backdropFilter: "blur(8px)",
          }}
        />
      </motion.div>

      <div
        className="fixed inset-0 flex items-center justify-center p-6"
        style={{ zIndex: 59, pointerEvents: "none" }}
      >
        <motion.div
          layoutId={`epic-card-${epicId}`}
          layout
          className="relative w-full max-w-3xl overflow-hidden"
          style={{
            maxHeight: "calc(100vh - 48px)",
            background: "var(--bg-elevated)",
            border: `0.5px solid ${summary.color}35`,
            borderLeft: `3px solid ${summary.color}`,
            borderRadius: 20,
            pointerEvents: "auto",
            willChange: "transform",
            boxShadow: `
              0 0 0 0.5px rgba(255,255,255,0.05),
              0 4px 24px rgba(0,0,0,0.3),
              0 24px 80px rgba(0,0,0,0.25),
              0 0 80px ${summary.color}15,
              inset 0 1px 0 rgba(255,255,255,0.05)
            `,
          }}
          transition={SPRING}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse 80% 40% at 10% 0%, ${summary.color}14 0%, transparent 50%),
                radial-gradient(ellipse 50% 60% at 90% 100%, ${summary.color}0c 0%, transparent 55%)
              `,
            }}
          />

          <div
            className="absolute top-0 left-0 right-0 h-px pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${summary.color}50 30%, rgba(255,255,255,0.14) 50%, ${summary.color}30 70%, transparent 100%)`,
            }}
          />

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-start gap-4 px-6 pt-5 pb-4 flex-shrink-0"
            style={{ borderBottom: `0.5px solid ${summary.color}20` }}
          >
            <div
              className="mt-1 w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `${summary.color}18`,
                border: `0.5px solid ${summary.color}40`,
                boxShadow: `0 0 20px ${summary.color}25`,
              }}
            >
              <span
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: summary.color, boxShadow: `0 0 12px ${summary.color}` }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                {summary.title}
              </h2>

              {summary.description && (
                <p className="text-sm mt-0.5 line-clamp-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {summary.description}
                </p>
              )}

              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs font-mono font-semibold" style={{ color: summary.color }}>
                  {summary.doneCount}/{summary.taskCount} задач
                </span>
                <div className="flex-1 max-w-[160px] h-1 rounded-full overflow-hidden" style={{ background: "var(--glass-02)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: summary.color, boxShadow: `0 0 8px ${summary.color}80` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                  />
                </div>
                <span className="text-xs font-mono font-semibold" style={{ color: summary.color }}>
                  {pct}%
                </span>
              </div>
            </div>

            <motion.button
              onClick={onClose}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--glass-02)",
                border: "0.5px solid var(--glass-border)",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
              whileHover={{ background: "var(--glass-03)", color: "var(--text-primary)" }}
              whileTap={{ scale: 0.92 }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </motion.button>
          </motion.div>

          {/* ── Body ── */}
          <div ref={scrollRef} className="relative overflow-y-auto" style={{ maxHeight: "calc(100vh - 48px - 96px)" }}>
            {loading ? (
              <WorkspaceSkeleton color={summary.color} />
            ) : fullEpic && byStatus ? (
              <motion.div
                className="px-6 py-5 space-y-6"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.03, delayChildren: 0.06 } },
                }}
              >
                {STATUS_ORDER.map((status) => (
                  <StatusSection
                    key={status}
                    status={status}
                    tasks={byStatus[status]}
                    epicColor={summary.color}
                    onOpenTask={onOpenTask}
                  />
                ))}
              </motion.div>
            ) : (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Не удалось загрузить задачи
                </p>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between px-6 py-3 flex-shrink-0"
            style={{ borderTop: `0.5px solid ${summary.color}15` }}
          >
            <div className="flex items-center gap-3">
              {summary.startDate && (
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  Старт: {formatDate(summary.startDate)}
                </span>
              )}
              {summary.endDate && (
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  Дедлайн: {formatDate(summary.endDate)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/epics/${epicId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: `${summary.color}15`,
                  color: summary.color,
                  border: `0.5px solid ${summary.color}30`,
                }}
                onClick={onClose}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4.5 2H12v7.5M12 2L2 12" />
                </svg>
                Открыть полностью
              </Link>

              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: "var(--glass-02)",
                  border: "0.5px solid var(--glass-border)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                Закрыть <kbd className="font-mono opacity-50 ml-1">Esc</kbd>
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}