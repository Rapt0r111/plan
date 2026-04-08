"use client";
/**
 * @file EpicModal.tsx — features/timeline/ui
 *
 * ИСПРАВЛЕНИЕ:
 *   БЫЛО: if (typeof document === "undefined") return null — антипаттерн,
 *         вызывает hydration mismatch.
 *   СТАЛО: useSyncExternalStore — React-благословлённый способ читать
 *          клиентское состояние с корректным SSR/гидрацией поведением.
 *          Идентичный паттерн используется в EpicInteractionLayer.tsx.
 */
import { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { formatDate } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { Ring } from "./Ring";
import { ModalTaskCard } from "./ModalTaskCard";
import type { EpicWithTasks, TaskView, TaskStatus } from "@/shared/types";

// ── SSR-safe client gate ──────────────────────────────────────────────────────

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,  // client snapshot
    () => false, // server snapshot — портал не рендерится на сервере
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const S: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  in_progress: { label: "В работе",      color: "#38bdf8", bg: "rgba(56,189,248,0.12)"  },
  todo:        { label: "К работе",      color: "#6b7fa3", bg: "rgba(107,127,163,0.12)" },
  blocked:     { label: "Заблокировано", color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  done:        { label: "Готово",        color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
};

const STATUS_ORDER: TaskStatus[] = ["in_progress", "blocked", "todo", "done"];

interface Props {
  epic:    EpicWithTasks;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EpicModal({ epic, onClose }: Props) {
  const isClient = useIsClient();
  const liveEpic = useTaskStore((s) => s.getEpic(epic.id)) ?? epic;

  const pct = liveEpic.progress.total > 0
    ? Math.round((liveEpic.progress.done / liveEpic.progress.total) * 100)
    : 0;

  const [filter, setFilter] = useState<TaskStatus | "all">("all");

  const byStatus = useMemo(() => {
    const g: Record<TaskStatus, TaskView[]> = {
      in_progress: [], todo: [], blocked: [], done: [],
    };
    for (const t of liveEpic.tasks) g[t.status]?.push(t);
    return g;
  }, [liveEpic]);

  const activeTasks = useMemo(() => {
    const active = STATUS_ORDER.filter((s) => s !== "done").flatMap((s) => byStatus[s]);
    if (filter === "all")  return active;
    if (filter === "done") return [];
    return byStatus[filter as TaskStatus];
  }, [filter, byStatus]);

  const archivedTasks = useMemo(
    () => filter === "all" || filter === "done" ? byStatus["done"] : [],
    [filter, byStatus],
  );

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  // Не рендерим портал на сервере — нет hydration mismatch
  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
        style={{ background: "var(--modal-backdrop)", backdropFilter: "blur(8px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex flex-col"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth:  640,
            maxHeight: "88vh",
            background:   "var(--bg-elevated)",
            border:       "1px solid var(--glass-border)",
            borderRadius: 20,
            boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${liveEpic.color}18`,
          }}
        >
          {/* Header */}
          <div
            className="shrink-0 px-5 pt-5 pb-4"
            style={{
              borderBottom: "1px solid var(--glass-border)",
              borderRadius: "20px 20px 0 0",
              background: `linear-gradient(135deg, ${liveEpic.color}0e 0%, transparent 55%)`,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base font-bold font-mono"
                style={{
                  background: `${liveEpic.color}1a`,
                  border:     `1.5px solid ${liveEpic.color}45`,
                  color:       liveEpic.color,
                }}
              >
                {liveEpic.title.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  {liveEpic.title}
                </h2>
                {liveEpic.description && (
                  <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                    {liveEpic.description}
                  </p>
                )}
                {liveEpic.startDate && (
                  <p className="text-[10px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
                    {formatDate(liveEpic.startDate)} → {liveEpic.endDate ? formatDate(liveEpic.endDate) : "…"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Ring pct={pct} color={liveEpic.color} size={44} />
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
                  style={{ background: "var(--glass-02)", color: "var(--text-muted)" }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Progress bar + status strip */}
            <div className="mt-4">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                  {liveEpic.progress.done} из {liveEpic.progress.total} задач выполнено
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--glass-02)" }}>
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  style={{ backgroundColor: liveEpic.color, boxShadow: `0 0 8px ${liveEpic.color}50` }}
                />
              </div>
              {liveEpic.progress.total > 0 && (
                <div className="flex h-1 mt-1.5 rounded-full overflow-hidden gap-px">
                  {STATUS_ORDER.map((s) => {
                    const n = byStatus[s].length;
                    if (!n) return null;
                    return (
                      <motion.div
                        key={s}
                        layout
                        title={`${S[s].label}: ${n}`}
                        style={{ flex: n, backgroundColor: S[s].color, opacity: 0.55 }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto"
            style={{ borderBottom: "1px solid var(--glass-border)" }}
          >
            {([
              ["all", `Все · ${liveEpic.tasks.length}`, liveEpic.color] as const,
              ...STATUS_ORDER.map((s) => [s, `${S[s].label} · ${byStatus[s].length}`, S[s].color] as const),
            ]).map(([key, label, color]) => {
              if (key !== "all" && !byStatus[key as TaskStatus]?.length) return null;
              const active = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key as typeof filter)}
                  className="px-3 py-1 rounded-lg text-[11px] font-mono font-medium transition-all shrink-0"
                  style={{
                    background: active ? `${color}20` : "var(--glass-01)",
                    color:      active ? color : "var(--text-muted)",
                    border:     active ? `1px solid ${color}40` : "1px solid var(--glass-border)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Task list */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
          >
            <LayoutGroup id={`epic-tasks-${liveEpic.id}`}>
              <motion.div layout className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {activeTasks.length === 0 && archivedTasks.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex flex-col items-center py-12 gap-3"
                    >
                      <span className="text-4xl opacity-20">📋</span>
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Нет задач</p>
                    </motion.div>
                  ) : (
                    activeTasks.map((task, i) => (
                      <ModalTaskCard key={task.id} task={task} index={i} epicColor={liveEpic.color} />
                    ))
                  )}
                </AnimatePresence>
              </motion.div>

              <AnimatePresence>
                {archivedTasks.length > 0 && (
                  <motion.div
                    key="archive"
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-3 mt-4 mb-3">
                      <div className="flex-1 h-px" style={{ background: "rgba(52,211,153,0.15)" }} />
                      <span
                        className="text-[10px] font-mono px-2.5 py-1 rounded-full"
                        style={{
                          background: "rgba(52,211,153,0.08)",
                          color:       "#34d399",
                          border:      "1px solid rgba(52,211,153,0.2)",
                        }}
                      >
                        Выполнено · {archivedTasks.length}
                      </span>
                      <div className="flex-1 h-px" style={{ background: "rgba(52,211,153,0.15)" }} />
                    </div>
                    <motion.div layout className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {archivedTasks.map((task, i) => (
                          <ModalTaskCard key={task.id} task={task} index={i} epicColor={liveEpic.color} />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </LayoutGroup>
          </div>

          {/* Footer */}
          <div
            className="shrink-0 px-5 py-3 flex justify-between items-center"
            style={{
              borderTop:    "1px solid var(--glass-border)",
              borderRadius: "0 0 20px 20px",
              background:   "rgba(255,255,255,0.012)",
            }}
          >
            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
              Space — отметить · Клик на задачу — подзадачи
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-75"
              style={{
                background: `${liveEpic.color}18`,
                color:       liveEpic.color,
                border:      `1px solid ${liveEpic.color}30`,
              }}
            >
              Закрыть
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}