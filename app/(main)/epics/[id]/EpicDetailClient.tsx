"use client";
/**
 * @file EpicDetailClient.tsx — app/(main)/epics/[id]
 *
 * NEW: Reads ?openTask=<id> from the URL on mount and auto-opens the
 * TaskSlideover for that task. Used by /tasks/[id]/page.tsx redirect so
 * direct task URLs resolve to the correct epic + open the slideover.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";

import { DarkTaskCard } from "@/widgets/task-list/DarkTaskCard";
import { TaskSlideover } from "@/features/task-details/TaskSlideover";
import type { EpicWithTasks, TaskView, TaskStatus } from "@/shared/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_ORDER = ["in_progress", "todo", "blocked", "done"] as const;

const STATUS_CFG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  in_progress: { label: "В работе",      color: "#38bdf8", bg: "rgba(14,165,233,0.10)"  },
  todo:        { label: "К работе",      color: "#64748b", bg: "rgba(100,116,139,0.10)" },
  blocked:     { label: "Заблокировано", color: "#f87171", bg: "rgba(239,68,68,0.10)"   },
  done:        { label: "Готово",        color: "#34d399", bg: "rgba(16,185,129,0.10)"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByStatus(tasks: EpicWithTasks["tasks"]) {
  const g: Record<TaskStatus, typeof tasks> = {
    in_progress: [], todo: [], blocked: [], done: [],
  };
  for (const t of tasks) g[t.status]?.push(t);
  return g;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EpicDetailClient({ epic }: { epic: EpicWithTasks }) {
  const searchParams = useSearchParams();

  // Lazy initializer: if ?openTask=<id> is present when the component first
  // mounts (e.g. redirect from /tasks/[id]/page.tsx), open that task
  // immediately — no effect, no extra render.
  const [activeTask, setActiveTask] = useState<TaskView | null>(() => {
    const id = searchParams?.get("openTask");
    if (!id) return null;
    return epic.tasks.find((t) => t.id === Number(id)) ?? null;
  });

  const grouped = groupByStatus(epic.tasks);
  const pct =
    epic.progress.total > 0
      ? Math.round((epic.progress.done / epic.progress.total) * 100)
      : 0;

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-8 max-w-6xl">

          {/* ── Hero progress banner ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-2xl overflow-hidden p-5"
            style={{
              background:  "var(--bg-elevated)",
              border:      "1px solid var(--glass-border)",
              borderLeft:  `4px solid ${epic.color}`,
            }}
          >
            {/* Ambient glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at top left, ${epic.color}18 0%, transparent 55%)`,
              }}
            />

            <div className="relative flex items-start gap-5">
              {/* Color dot */}
              <div
                className="mt-0.5 w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
                style={{
                  backgroundColor: `${epic.color}20`,
                  border:          `1px solid ${epic.color}40`,
                  boxShadow:       `0 0 20px ${epic.color}30`,
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: epic.color }}
                />
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                {epic.description && (
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {epic.description}
                  </p>
                )}

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Прогресс
                    </span>
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{ color: epic.color }}
                    >
                      {epic.progress.done}/{epic.progress.total}
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--track-bg)" }
}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: epic.color,
                        boxShadow:       `0 0 10px ${epic.color}80`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                    />
                  </div>
                </div>
              </div>

              {/* Big pct */}
              <div className="shrink-0 text-right" style={{ color: epic.color }}>
                <motion.span
                  className="text-3xl font-bold font-mono tabular-nums"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {pct}%
                </motion.span>
              </div>
            </div>
          </motion.div>

          {/* ── Status sections ───────────────────────────────────────── */}
          {STATUS_ORDER.map((status, sectionIdx) => {
            const group = grouped[status];
            // Hide "blocked" section entirely when empty
            if (!group?.length && status === "blocked") return null;
            const { label, color, bg } = STATUS_CFG[status];

            return (
              <motion.section
                key={status}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  ease:     [0.16, 1, 0.3, 1],
                  delay:    0.1 + sectionIdx * 0.07,
                }}
              >
                {/* Section header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border"
                    style={{ background: bg, color, borderColor: `${color}30` }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </div>
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    {group?.length ?? 0}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "var(--glass-border)" }} />
                </div>

                {/* Task grid */}
                {!group?.length ? (
                  <p className="text-xs pl-2" style={{ color: "var(--text-muted)" }}>
                    Нет задач
                  </p>
                ) : (
                  <motion.div
                    className="grid grid-cols-1 lg:grid-cols-2 gap-3"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: { transition: { staggerChildren: 0.05 } },
                    }}
                  >
                    {group.map((task) => (
                      <motion.div
                        key={task.id}
                        variants={{
                          hidden:   { opacity: 0, y: 8 },
                          visible:  {
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
                          },
                        }}
                      >
                        <DarkTaskCard
                          task={task}
                          epicColor={epic.color}
                          onOpen={setActiveTask}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </motion.section>
            );
          })}
        </div>
      </div>

      {/* Slide-over */}
      <TaskSlideover task={activeTask} onClose={() => setActiveTask(null)} />
    </>
  );
}