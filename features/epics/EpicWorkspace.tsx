"use client";
/**
 * @file EpicWorkspace.tsx — features/epics
 *
 * ═══════════════════════════════════════════════════════════
 * EPIC WORKSPACE — IMMERSIVE MORPHING CONTAINER (2027)
 * ═══════════════════════════════════════════════════════════
 *
 * LAYOUT PROJECTION:
 *  Использует тот же layoutId={`epic-card-${epicId}`}, что и EpicCard.
 *  Framer Motion автоматически вычисляет FLIP-трансформацию:
 *   1. Записывает bounding rect EpicCard (source)
 *   2. При монтировании EpicWorkspace читает её target rect (viewport)
 *   3. Анимирует scale/position от source к target
 *  Эффект: карточка «расширяется» в рабочее пространство.
 *
 * SPRING PHYSICS (высокое натяжение, минимальная масса):
 *  stiffness: 350, damping: 32, mass: 0.8
 *  Даёт снаппи ощущение пространственного перехода без bounce.
 *
 * СТРУКТУРА СЛОЁВ (z-axis):
 *  backdrop    z-40  — blur + dark overlay
 *  workspace   z-50  — морфирующий контейнер (layoutId)
 *  close btn   z-51  — поверх контейнера
 *
 * DATA FETCHING:
 *  При открытии делает fetch /api/epics/:id (возвращает EpicWithTasks).
 *  Пока данные грузятся — показывает skeleton в стиле карточки,
 *  чтобы морфинг не выглядел пустым.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatDate } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { STATUS_META, STATUS_ORDER } from "@/shared/config/task-meta";
import type { EpicSummary, EpicWithTasks, TaskView, TaskStatus } from "@/shared/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING = { type: "spring" as const, stiffness: 350, damping: 32, mass: 0.8 };

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

  const progress = liveTask.progress.total > 0
    ? liveTask.progress.done / liveTask.progress.total
    : 0;

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
      {/* Priority left accent */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ backgroundColor: epicColor, opacity: 0.5 }}
      />

      {/* Status cycle button */}
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

      {/* Title + description */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium leading-snug",
            liveTask.status === "done" && "line-through opacity-50"
          )}
          style={{ color: "var(--text-primary)" }}
        >
          {liveTask.title}
        </p>

        {liveTask.description && (
          <p
            className="text-xs mt-0.5 line-clamp-1 leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {liveTask.description}
          </p>
        )}

        {/* Subtask mini-bar */}
        {liveTask.subtasks.length > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <div
              className="flex-1 max-w-[80px] h-0.5 rounded-full overflow-hidden"
              style={{ background: "var(--glass-02)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress * 100}%`, backgroundColor: epicColor }}
              />
            </div>
            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
              {liveTask.progress.done}/{liveTask.progress.total}
            </span>
          </div>
        )}
      </div>

      {/* Assignees */}
      {liveTask.assignees.length > 0 && (
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

      {/* Due date */}
      {liveTask.dueDate && (
        <span
          className="shrink-0 text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
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
            <TaskRow
              key={t.id}
              task={t}
              epicColor={epicColor}
              onOpen={onOpenTask}
            />
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
          <div
            className="h-5 w-28 rounded-full"
            style={{ background: `${color}18` }}
          />
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

export function EpicWorkspace({
  epicId,
  summary,
  onClose,
  onOpenTask,
}: EpicWorkspaceProps) {
  const [fullEpic, setFullEpic] = useState<EpicWithTasks | null>(null);
  const [loading, setLoading] = useState(true);

  // Добавь эти две строки:
  const scrollRef = useRef<HTMLDivElement>(null); // Восстанавливаем реф для скролла
  const [prevId, setPrevId] = useState(epicId);

  // Логика сброса при смене пропсов (твоё верное исправление)
  if (epicId !== prevId) {
    setPrevId(epicId);
    setLoading(true);
    setFullEpic(null);
  }

  // 2. В эффекте оставляем только асинхронную работу
  useEffect(() => {
    let ignore = false; // Чистим за собой, чтобы не было гонки данных

    fetch(`/api/epics/${epicId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!ignore && d.ok) {
          setFullEpic(d.data);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [epicId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const progress = summary.taskCount > 0
    ? summary.doneCount / summary.taskCount
    : 0;
  const pct = Math.round(progress * 100);

  // Group tasks by status
  const byStatus = fullEpic
    ? STATUS_ORDER.reduce<Record<TaskStatus, TaskView[]>>(
      (acc, s) => {
        acc[s] = fullEpic.tasks.filter((t) => t.status === s);
        return acc;
      },
      { in_progress: [], todo: [], blocked: [], done: [] }
    )
    : null;

  // Animated stats counter
  const animPct = useSpring(0, { stiffness: 80, damping: 20 });
  useEffect(() => { animPct.set(pct); }, [pct, animPct]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="ws-backdrop"
        className="fixed inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          background: "rgba(4,5,10,0.78)",
          backdropFilter: "blur(8px)",
        }}
        onClick={onClose}
      />

      {/* Workspace panel — layoutId matches EpicCard */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <motion.div
          layoutId={`epic-card-${epicId}`}
          layout
          className="relative w-full max-w-3xl pointer-events-auto overflow-hidden"
          style={{
            maxHeight: "calc(100vh - 48px)",
            background: "var(--bg-elevated)",
            border: `0.5px solid ${summary.color}35`,
            borderLeft: `3px solid ${summary.color}`,
            borderRadius: 20,
            boxShadow: `
              0 0 0 0.5px rgba(255,255,255,0.05),
              0 4px 24px rgba(0,0,0,0.6),
              0 24px 80px rgba(0,0,0,0.5),
              0 0 80px ${summary.color}15,
              inset 0 1px 0 rgba(255,255,255,0.05)
            `,
          }}
          transition={SPRING}
        >
          {/* Mesh gradient bg */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse 80% 40% at 10% 0%,
                  ${summary.color}14 0%, transparent 50%),
                radial-gradient(ellipse 50% 60% at 90% 100%,
                  ${summary.color}0c 0%, transparent 55%),
                radial-gradient(ellipse 35% 35% at 50% 50%,
                  rgba(255,255,255,0.018) 0%, transparent 70%)
              `,
            }}
          />

          {/* Top shimmer */}
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
            transition={{ delay: 0.12, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-start gap-4 px-6 pt-5 pb-4 flex-shrink-0"
            style={{ borderBottom: `0.5px solid ${summary.color}20` }}
          >
            {/* Epic color orb indicator */}
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
                style={{
                  backgroundColor: summary.color,
                  boxShadow: `0 0 12px ${summary.color}`,
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h2
                className="text-lg font-semibold leading-snug"
                style={{ color: "var(--text-primary)" }}
              >
                {summary.title}
              </h2>

              {summary.description && (
                <p
                  className="text-sm mt-0.5 line-clamp-2 leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {summary.description}
                </p>
              )}

              {/* Progress stats row */}
              <div className="flex items-center gap-4 mt-2">
                <span
                  className="text-xs font-mono font-semibold"
                  style={{ color: summary.color }}
                >
                  {summary.doneCount}/{summary.taskCount} задач
                </span>
                <div
                  className="flex-1 max-w-[160px] h-1 rounded-full overflow-hidden"
                  style={{ background: "var(--glass-02)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: summary.color,
                      boxShadow: `0 0 8px ${summary.color}80`,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  />
                </div>
                <span
                  className="text-xs font-mono font-semibold"
                  style={{ color: summary.color }}
                >
                  {pct}%
                </span>
              </div>
            </div>

            {/* Close */}
            <motion.button
              onClick={onClose}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--glass-02)",
                border: "0.5px solid var(--glass-border)",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
              whileHover={{
                background: "var(--glass-03)",
                color: "var(--text-primary)",
              }}
              whileTap={{ scale: 0.92 }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </motion.button>
          </motion.div>

          {/* ── Body — task sections ── */}
          <div
            ref={scrollRef}
            className="relative overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 48px - 96px)" }}
          >
            {loading ? (
              <WorkspaceSkeleton color={summary.color} />
            ) : fullEpic && byStatus ? (
              <motion.div
                className="px-6 py-5 space-y-6"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
                }}
              >
                {STATUS_ORDER.map((status) => (
                  <StatusSection
                    key={status}
                    status={status}
                    tasks={byStatus[status]}
                    epicColor={summary.color}
                    onOpenTask={(task) => {
                      onOpenTask(task);
                      onClose();
                    }}
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
            transition={{ delay: 0.2 }}
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
              <a
                href={`/epics/${epicId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: `${summary.color}15`,
                  color: summary.color,
                  border: `0.5px solid ${summary.color}30`,
                }}
                onClick={onClose}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4.5 2H12v7.5M12 2L2 12" />
                </svg>
                Открыть полностью
              </a>

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