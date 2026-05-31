"use client";
/**
 * @file BoardPage.tsx — app/(main)/board/BoardPage.tsx
 */
import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useTransition,
  useSyncExternalStore,
  memo,
  useRef,
} from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { SmartFilters, EMPTY_FILTERS, applyFilters } from "@/features/filters/SmartFilters";
import { EpicColumn } from "@/widgets/board/EpicColumn";
import { useBoardKeyNav } from "@/features/board/useBoardKeyNav";
import type { FilterState } from "@/features/filters/SmartFilters";
import type { TaskView } from "@/shared/types";
import { usePrefsStore } from "@/shared/store/usePrefsStore";

const TaskSlideover = dynamic(
  () => import("@/features/task-details/TaskSlideover").then((m) => ({ default: m.TaskSlideover })),
  { ssr: false },
);

// ── Модульные константы ───────────────────────────────────────────────────────

const COL_WIDTHS = { narrow: 320, default: 420, wide: 520 } as const;
type ColWidthKey = keyof typeof COL_WIDTHS;

const SUBSCRIBE_NOOP = () => () => {};

const HINT_KEY = "board_keynav_hint_v5";


const exitVariant = {
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -8,
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as const },
  },
};

const MemoEpicColumn = memo(EpicColumn);

// ── BoardStats ────────────────────────────────────────────────────────────────
const BoardStats = memo(function BoardStats({
  total, done, inProgress, epicsCount,
}: {
  total: number; done: number; inProgress: number; epicsCount: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = [
    { label: "Эпиков",   value: epicsCount, color: "#a78bfa" },
    { label: "Задач",    value: total,      color: "#94a3b8" },
    { label: "В работе", value: inProgress, color: "#38bdf8" },
    { label: "Готово",   value: done,       color: "#34d399" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="flex items-center gap-1 flex-wrap"
    >
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 + i * 0.05 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
          <span className="text-xs font-mono font-semibold" style={{ color: s.color }}>{s.value}</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</span>
        </motion.div>
      ))}

      {total > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg ml-1"
          style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          <div
            className="w-16 h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, #8b5cf6, #34d399)",
                transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>
          <span className="text-xs font-mono font-semibold" style={{ color: "#a78bfa" }}>{pct}%</span>
        </motion.div>
      )}
    </motion.div>
  );
});

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState = memo(function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-28 text-center"
    >
      <div className="relative mb-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: "var(--glass-02)",
            border: "1px solid var(--glass-border)",
            boxShadow: "0 0 40px rgba(139,92,246,0.12)",
          }}
        >
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)"
            strokeWidth="1.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
          style={{ background: "rgba(139,92,246,0.6)", boxShadow: "0 0 8px rgba(139,92,246,0.8)" }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
      <p className="text-base font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
        Ничего не найдено
      </p>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        Попробуйте изменить условия фильтрации
      </p>
      <motion.button
        onClick={onClear}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium"
        style={{
          background: "rgba(139,92,246,0.12)",
          border: "1px solid rgba(139,92,246,0.28)",
          color: "#a78bfa",
        }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round">
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
        Сбросить фильтры
      </motion.button>
    </motion.div>
  );
});

// ── Keyboard hint ─────────────────────────────────────────────────────────────
function useHintVisible() {
  const notDismissedInStorage = useSyncExternalStore(
    SUBSCRIBE_NOOP,
    () => !localStorage.getItem(HINT_KEY),
    () => false,
  );
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const visible = notDismissedInStorage && !dismissedLocally;

  const dismiss = useCallback(() => {
    setDismissedLocally(true);
    try { localStorage.setItem(HINT_KEY, "1"); } catch {}
  }, []);

  return { visible, dismiss };
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono"
      style={{
        background: "var(--glass-02)",
        border: "1px solid var(--glass-border)",
        color: "var(--text-secondary)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </kbd>
  );
}

const KeyboardHint = memo(function KeyboardHint() {
  const { visible, dismiss } = useHintVisible();

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(dismiss, 9000);
    return () => clearTimeout(t);
  }, [visible, dismiss]);

  const shortcuts = [
    { keys: ["J", "K"], label: "навигация" },
    { keys: ["↵"],      label: "открыть"   },
    { keys: ["E"],      label: "статус"    },
    { keys: ["Esc"],    label: "сброс"     },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-5 py-3 rounded-2xl"
          style={{
            background: "var(--modal-bg)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(139,92,246,0.12), 0 0 40px rgba(139,92,246,0.06)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Горячие клавиши</span>
          </div>
          <div className="w-px h-4 self-center" style={{ background: "var(--glass-border)" }} />
          <div className="flex items-center gap-3">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1">
                  {s.keys.map((k) => <KbdKey key={k}>{k}</KbdKey>)}
                </div>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{s.label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center ml-1 transition-opacity hover:opacity-60"
            style={{ background: "var(--glass-02)", color: "var(--text-muted)" }}
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l6 6M8 2L2 8" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ── Column count hook ─────────────────────────────────────────────────────────
function useColumnCount(minColWidth: number): number {
  const [count, setCount] = useState(3);

  useEffect(() => {
    function calc() {
      const available = document.documentElement.clientWidth - 48;
      setCount(Math.max(1, Math.floor(available / minColWidth)));
    }

    calc();

    let rafId: number;
    function handleResize() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(calc);
    }

    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafId);
    };
  }, [minColWidth]);

  return count;
}

function splitIntoColumns<T>(items: T[], n: number): T[][] {
  const cols: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => cols[i % n].push(item));
  return cols;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function BoardPage() {
  const epics = useTaskStore((s) => s.epics);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [activeTask, setActiveTask] = useState<TaskView | null>(null);

  const [, startFilterTransition] = useTransition();

  const showBoardStats   = usePrefsStore((s) => s.prefs.showBoardStats);
  const boardColumnWidth = usePrefsStore((s) => s.prefs.boardColumnWidth) as ColWidthKey;

  const hasFilters = useMemo(
    () =>
      filters.roleKeys.length > 0 ||
      filters.statuses.length > 0 ||
      filters.priorities.length > 0,
    [filters],
  );

  const visibleEpics = useMemo(() => {
    if (!hasFilters) return epics;
    return epics.filter((e) => applyFilters(e.tasks, filters).length > 0);
  }, [epics, filters, hasFilters]);

  const { focusedTaskId, setFocusedTaskId } = useBoardKeyNav({
    visibleEpics,
    onOpenTask: setActiveTask,
  });

  const handleOpenTask = useCallback(
    (task: TaskView) => {
      setFocusedTaskId(task.id);
      setActiveTask(task);
    },
    [setFocusedTaskId],
  );

  const clearFilters = useCallback(() => {
    startFilterTransition(() => setFilters(EMPTY_FILTERS));
  }, [startFilterTransition]);

  const handleFiltersChange = useCallback(
    (next: FilterState) => {
      startFilterTransition(() => setFilters(next));
    },
    [startFilterTransition],
  );

  const colCount = useColumnCount(COL_WIDTHS[boardColumnWidth]);

  const columns = useMemo(
    () => splitIntoColumns(visibleEpics, colCount),
    [visibleEpics, colCount],
  );

  const stats = useMemo(() => {
    const allTasks = epics.flatMap((e) => e.tasks);
    return {
      total:      allTasks.length,
      done:       allTasks.filter((t) => t.status === "done").length,
      inProgress: allTasks.filter((t) => t.status === "in_progress").length,
      epicsCount: epics.length,
    };
  }, [epics]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div
        className="shrink-0 border-b animate-fade-up"
        style={{
          background: "var(--filter-bar-bg)",
          backdropFilter: "blur(20px)",
          borderColor: "var(--glass-border)",

          willChange: "transform",
          transform: "translateZ(0)",
        }}
      >
        <div className="px-6 py-2.5 flex items-center gap-4">
          <div className="flex-1">
            <SmartFilters filters={filters} onChange={handleFiltersChange} />
          </div>
        </div>

        {showBoardStats && (
          <div className="px-6 pb-2.5">
            <BoardStats {...stats} />
          </div>
        )}
      </div>

      {/* ── Board area ───────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-x-auto overflow-y-auto"
        style={{
          contain: "layout",
          overscrollBehaviorX: "contain",
        }}
      >
        <div className="p-6 min-h-full">
          <AnimatePresence>
            {hasFilters && visibleEpics.length === 0 && (
              <EmptyState onClear={clearFilters} />
            )}
          </AnimatePresence>

          <div className="flex gap-5 items-start">
            {columns.map((colEpics, colIdx) => (
              <div
                key={colEpics[0]?.id ?? colIdx}
                className="flex flex-col gap-5 flex-1 min-w-0"
              >
                <AnimatePresence>
                  {colEpics.map((epic, rowIdx) => {
                    const globalIdx = colIdx + rowIdx * colCount;
                    const delay = Math.min(globalIdx * 60, 400); // cap at 400ms

                    return (
                      <motion.div
                        key={epic.id}
                        variants={exitVariant}
                        exit="exit"
                        // CSS handles mount animation — no initial/animate on motion.div
                        style={{
                          animationDelay: `${delay}ms`,
                        }}
                        className="animate-fade-up"
                      >
                        <MemoEpicColumn
                          epic={epic}
                          filters={filters}
                          onOpenTask={handleOpenTask}
                          focusedTaskId={focusedTaskId}
                          onFocusTask={setFocusedTaskId}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Task slideover ───────────────────────────────────────────── */}
      {activeTask && (
        <TaskSlideover task={activeTask} onClose={() => setActiveTask(null)} />
      )}

      {/* ── Keyboard hint ────────────────────────────────────────────── */}
      <KeyboardHint />
    </div>
  );
}