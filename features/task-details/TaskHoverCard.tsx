"use client";
/**
 * @file TaskHoverCard.tsx — features/task-details
 *
 * Floating preview card shown on task hover (350ms delay).
 *
 * DESIGN:
 *  Renders via createPortal → no z-index/overflow clipping from ancestors.
 *  pointer-events: none → cursor can move away cleanly without "sticking".
 *  Left-border inherits priority colour — instant visual scan without reading.
 *
 * POSITIONING:
 *  Prefers right side of anchor; flips left when near viewport edge.
 *  Vertically clamped to stay within viewport bounds.
 */
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { formatDate } from "@/shared/lib/utils";
import type { TaskView } from "@/shared/types";

const STATUS_CFG: Record<string, { label: string; color: string }> = {
    todo: { label: "К работе", color: "#94a3b8" },
    in_progress: { label: "В работе", color: "#38bdf8" },
    done: { label: "Готово", color: "#34d399" },
    blocked: { label: "Заблокировано", color: "#f87171" },
};

const PRIORITY_COLOR: Record<string, string> = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#475569",
};

const CARD_W = 276;
const CARD_GAP = 10;

interface Props {
    task: TaskView;
    anchorEl: HTMLElement | null;
    visible: boolean;
}

export function TaskHoverCard({ task, anchorEl, visible }: Props) {

    // Gate portal rendering to client-only

    let pos = { left: 0, top: 0, fromRight: false };

    if (visible && anchorEl && typeof window !== "undefined") {
        const rect = anchorEl.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const fromRight = vw - rect.right < CARD_W + CARD_GAP;

        const left = fromRight
            ? rect.left - CARD_W - CARD_GAP
            : rect.right + CARD_GAP;

        const top = Math.max(8, Math.min(rect.top, vh - 256));

        pos = { left, top, fromRight };
    }

    if (typeof document === "undefined") return null;
    const priorityColor = PRIORITY_COLOR[task.priority] ?? "#475569";
    const statusCfg = STATUS_CFG[task.status] ?? STATUS_CFG.todo;
    const done = task.subtasks.filter(s => s.isCompleted).length;
    const total = task.subtasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const isDone = task.status === "done";



    return createPortal(
        <AnimatePresence>
            {visible && (
                <motion.div
                    key={`hover-${task.id}`}
                    initial={{ opacity: 0, scale: 0.95, x: pos.fromRight ? 6 : -6 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    className="fixed pointer-events-none select-none"
                    style={{
                        left: pos.left,
                        top: pos.top,
                        width: CARD_W,
                        zIndex: 9997,
                        background: "var(--bg-elevated)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        borderLeft: `3px solid ${priorityColor}`,
                        borderRadius: 14,
                        boxShadow: [
                            "0 24px 64px rgba(0,0,0,0.72)",
                            "0 0 0 1px rgba(255,255,255,0.03)",
                            `0 0 20px ${priorityColor}14`,
                        ].join(", "),
                        padding: "12px 14px",
                    }}
                >
                    {/* ── Header: id + priority ───────────────────────────────── */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                            #{task.id}
                        </span>
                        <span
                            className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full"
                            style={{
                                background: `${priorityColor}18`,
                                color: priorityColor,
                                border: `1px solid ${priorityColor}30`,
                            }}
                        >
                            {task.priority}
                        </span>
                    </div>

                    {/* ── Title ───────────────────────────────────────────────── */}
                    <p
                        className="text-sm font-semibold leading-snug mb-1.5"
                        style={{
                            color: isDone ? "var(--text-muted)" : "var(--text-primary)",
                            textDecoration: isDone ? "line-through" : "none",
                        }}
                    >
                        {task.title}
                    </p>

                    {/* ── Description ─────────────────────────────────────────── */}
                    {task.description && (
                        <p
                            className="text-xs line-clamp-2 leading-relaxed mb-2.5"
                            style={{ color: "var(--text-muted)" }}
                        >
                            {task.description}
                        </p>
                    )}

                    {/* ── Status + due date ───────────────────────────────────── */}
                    <div className="flex items-center gap-2 mb-3">
                        <span
                            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                                background: `${statusCfg.color}18`,
                                color: statusCfg.color,
                                border: `1px solid ${statusCfg.color}28`,
                            }}
                        >
                            {statusCfg.label}
                        </span>
                        {task.dueDate && (
                            <span
                                className="text-[11px] font-mono ml-auto"
                                style={{ color: "var(--text-muted)" }}
                            >
                                {formatDate(task.dueDate)}
                            </span>
                        )}
                    </div>

                    {/* ── Subtask progress ────────────────────────────────────── */}
                    {total > 0 && (
                        <div className="mb-3">
                            <div className="flex justify-between items-center mb-1">
                                <span
                                    className="text-[9px] uppercase tracking-widest font-semibold"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Подзадачи
                                </span>
                                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                                    {done}/{total} · {pct}%
                                </span>
                            </div>
                            <div
                                className="h-1 rounded-full overflow-hidden"
                                style={{ background: "rgba(255,255,255,0.06)" }}
                            >
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: `${pct}%`,
                                        backgroundColor: priorityColor,
                                        boxShadow: `0 0 6px ${priorityColor}55`,
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Assignees ───────────────────────────────────────────── */}
                    {task.assignees.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                            {task.assignees.slice(0, 4).map(a => (
                                <div
                                    key={a.id}
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]"
                                    style={{
                                        background: `${a.roleMeta.hex}15`,
                                        color: a.roleMeta.hex,
                                        border: `1px solid ${a.roleMeta.hex}25`,
                                    }}
                                >
                                    <div
                                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                                        style={{ backgroundColor: a.roleMeta.hex }}
                                    >
                                        {a.initials}
                                    </div>
                                    {a.roleMeta.short}
                                </div>
                            ))}
                            {task.assignees.length > 4 && (
                                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                                    +{task.assignees.length - 4}
                                </span>
                            )}
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
}