// features/timeline/InfiniteTimeline.tsx
"use client";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useTimelineLayout, LEFT_W, MAX_AREA_H } from "./model/useTimelineLayout";
import { useTimelinePan } from "./model/useTimelinePan";
import { TimelineRuler } from "./ui/TimelineRuler";
import { TimelineRow } from "./ui/TimelineRow";
import { EpicModal } from "./ui/EpicModal";
import type { TaskStatus } from "@/shared/types";

// Hex fallbacks нужны там где CSS var нельзя использовать напрямую (напр. rgba())
const S_COLOR_HEX: Record<TaskStatus, string> = {
  in_progress: "#38bdf8", todo: "#6b7fa3", blocked: "#f87171", done: "#34d399",
};
const S_LABEL: Record<TaskStatus, string> = {
  in_progress: "В работе", todo: "К работе", blocked: "Заблокировано", done: "Готово",
};
const STATUS_ORDER: TaskStatus[] = ["in_progress", "blocked", "todo", "done"];

export function InfiniteTimeline() {
  const epics = useTaskStore((s) => s.epics);
  const layout = useTimelineLayout(epics);
  const { scrollRef, isDrag, onPointerDown, onPointerMove, onPointerUp } = useTimelinePan();

  const [modalId, setModalId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const modalEpic = useMemo(() => epics.find((e) => e.id === modalId) ?? null, [epics, modalId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, layout.todayX - el.clientWidth / 2 + LEFT_W);
    });
  }, [layout.todayX, scrollRef]);

  const totalTasks = epics.reduce((s, e) => s + e.progress.total, 0);
  const doneTasks  = epics.reduce((s, e) => s + e.progress.done, 0);
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const statusCounts = useMemo(() => {
    const c: Record<TaskStatus, number> = { in_progress: 0, todo: 0, blocked: 0, done: 0 };
    for (const e of epics) for (const t of e.tasks) c[t.status]++;
    return c;
  }, [epics]);

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
    >
      {/* Widget header */}
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "var(--accent-glow)",
            border: "1px solid var(--glass-border-active)",
          }}
        >
          <svg
            className="w-4 h-4"
            style={{ color: "var(--accent-400)" }}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2 4h8M2 8h12M2 12h6" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Хронолента
          </p>
          <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
            {epics.length} эпиков · {totalTasks} задач
          </p>
        </div>

        {/* Progress bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div
            className="w-28 h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--glass-02)" }}
          >
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${overallPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ background: "linear-gradient(90deg, var(--accent-500), var(--color-done))" }}
            />
          </div>
          <span
            className="text-xs font-bold font-mono"
            style={{ color: "var(--color-done)" }}
          >
            {overallPct}%
          </span>
        </div>

        <div className="w-px h-5 shrink-0" style={{ background: "var(--glass-border)" }} />

        {/* Status legend */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {STATUS_ORDER.map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: S_COLOR_HEX[s] }}
              />
              <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                {S_LABEL[s]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Gantt area */}
      <div
        ref={scrollRef}
        className="relative overflow-auto"
        style={{
          maxHeight: MAX_AREA_H,
          cursor: isDrag ? "grabbing" : "grab",
          userSelect: "none",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--glass-border) transparent",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div style={{ minWidth: LEFT_W + layout.canvasW, position: "relative" }}>
          <TimelineRuler layout={layout} />

          {/* Background: month lines + today line */}
          <div
            className="absolute pointer-events-none"
            style={{ top: 0, left: LEFT_W, right: 0, bottom: 0, zIndex: 0 }}
          >
            {layout.months.map(({ x, isJan }) => (
              <div
                key={`vl-${x}`}
                className="absolute top-0 bottom-0 w-px"
                style={{
                  left: x,
                  // CSS var нельзя в rgba(), используем glass-border с opacity
                  background: isJan
                    ? "var(--glass-border-active)"
                    : "var(--glass-border)",
                  opacity: isJan ? 0.6 : 0.4,
                }}
              />
            ))}
            {/* Today line */}
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: layout.todayX,
                width: 1.5,
                background: "var(--accent-500)",
                opacity: 0.5,
              }}
            />
          </div>

          {/* Epic rows */}
          {layout.bars.map((bar, idx) => (
            <TimelineRow
              key={bar.epic.id}
              bar={bar}
              index={idx}
              hovered={hoveredId === bar.epic.id}
              onHover={(v) => setHoveredId(v ? bar.epic.id : null)}
              onOpenModal={setModalId}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="shrink-0 flex items-center gap-4 px-5 py-2"
        style={{
          borderTop: "1px solid var(--glass-border)",
          background: "var(--glass-01)",
        }}
      >
        <div className="flex items-center gap-4 flex-1">
          {[
            { key: "drag",  icon: "⟺",   text: "Перетащите" },
            { key: "click", icon: "↗",    text: "Клик → задачи" },
            { key: "space", icon: "Space", text: "Отметить" },
          ].map(({ key, icon, text }) => (
            <div
              key={key}
              className="flex items-center gap-1 text-[10px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-3">
          {STATUS_ORDER.map((s) => {
            const n = statusCounts[s];
            if (!n) return null;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: S_COLOR_HEX[s] }}
                />
                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalEpic && (
          <EpicModal key={modalEpic.id} epic={modalEpic} onClose={() => setModalId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}