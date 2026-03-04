"use client";
/**
 * @file InfiniteTimeline.tsx — features/timeline (v5)
 *
 * 2026 UI/UX upgrade:
 *  ✦ MagneticCheckbox on every task row (magnetic pull + Space hotkey)
 *  ✦ Aurora Pointer on epic bars (two-layer specular + colored aurora)
 *  ✦ Soft Pop spring burst on completion (stiffness 400, damping 25)
 *  ✦ Animated strikethrough via scaleX layout animation
 *  ✦ Fluid archive: completed tasks sink to bottom section with LayoutGroup
 *  ✦ layoutId morph between active ↔ archived states
 *
 * Architecture: FSD-compliant. Zustand for all status mutations (optimistic).
 */

import {
    useRef, useCallback, useMemo, useState, useEffect,
} from "react";
import { createPortal } from "react-dom";
import {
    motion, AnimatePresence, LayoutGroup,
} from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { formatDate } from "@/shared/lib/utils";
import { MagneticCheckbox } from "@/shared/ui/MagneticCheckbox";
import { useShinyEffect } from "@/shared/lib/hooks/useShinyEffect";
import type { EpicWithTasks, TaskView, TaskStatus } from "@/shared/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PX_PER_DAY = 6;
const LANE_H = 56;
const RULER_H = 44;
const LEFT_W = 196;
const RIGHT_PAD = 80;
const MIN_BAR_W = 72;
const MAX_AREA_H = 520;

// ─── Status meta ─────────────────────────────────────────────────────────────

const S: Record<TaskStatus, { label: string; color: string; bg: string }> = {
    in_progress: { label: "В работе", color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
    todo: { label: "К работе", color: "#6b7fa3", bg: "rgba(107,127,163,0.12)" },
    blocked: { label: "Заблокировано", color: "#f87171", bg: "rgba(248,113,113,0.12)" },
    done: { label: "Готово", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
};
const STATUS_ORDER: TaskStatus[] = ["in_progress", "blocked", "todo", "done"];

// ─── Date utils ───────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date) {
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function addDays(d: Date, n: number) {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface Bar {
    epic: EpicWithTasks;
    barX: number;
    barW: number;
    pct: number;
    hasDates: boolean;
    overdue: boolean;
}

interface Layout {
    origin: Date;
    canvasW: number;
    todayX: number;
    bars: Bar[];
    months: { x: number; label: string; isJan: boolean }[];
}

function buildLayout(epics: EpicWithTasks[]): Layout {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let origin = addDays(now, -20);
    let terminus = addDays(now, 90);

    const dated = epics.filter((e) => e.startDate || e.endDate);
    if (dated.length) {
        const ss = dated.filter((e) => e.startDate).map((e) => new Date(e.startDate!).getTime());
        const es = dated.filter((e) => e.endDate).map((e) => new Date(e.endDate!).getTime());
        if (ss.length) origin = addDays(new Date(Math.min(...ss)), -16);
        if (es.length) terminus = addDays(new Date(Math.max(...es)), 18);
    }

    const canvasW = daysBetween(origin, terminus) * PX_PER_DAY + RIGHT_PAD;
    const todayX = daysBetween(origin, now) * PX_PER_DAY;

    const bars: Bar[] = epics.map((epic) => {
        const pct = epic.progress.total > 0 ? epic.progress.done / epic.progress.total : 0;
        if (!epic.startDate && !epic.endDate) {
            return { epic, barX: 12, barW: canvasW - 40, pct, hasDates: false, overdue: false };
        }
        const start = new Date(epic.startDate ?? now); start.setHours(0, 0, 0, 0);
        const end = epic.endDate ? new Date(epic.endDate) : addDays(start, 30); end.setHours(0, 0, 0, 0);
        const barX = Math.max(0, daysBetween(origin, start) * PX_PER_DAY);
        const barW = Math.max(daysBetween(start, end) * PX_PER_DAY, MIN_BAR_W);
        const overdue = end < now && pct < 1;
        return { epic, barX, barW, pct, hasDates: true, overdue };
    });

    const months: Layout["months"] = [];
    const cur = new Date(origin); cur.setDate(1);
    while (cur <= terminus) {
        months.push({
            x: Math.max(0, daysBetween(origin, cur) * PX_PER_DAY),
            label: cur.toLocaleDateString("ru-RU", {
                month: "long",
                ...(cur.getMonth() === 0 ? { year: "2-digit" } : {}),
            }),
            isJan: cur.getMonth() === 0,
        });
        cur.setMonth(cur.getMonth() + 1);
    }

    return { origin, canvasW, todayX, bars, months };
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function Ring({ pct, color, size = 40 }: { pct: number; color: string; size?: number }) {
    const r = (size - 6) / 2;
    const C = 2 * Math.PI * r;
    return (
        <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="absolute inset-0 -rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke="rgba(255,255,255,0.07)" strokeWidth={3} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={color} strokeWidth={3} strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
                    style={{ transition: "stroke-dashoffset 0.7s ease" }}
                />
            </svg>
            <span className="relative text-[10px] font-bold font-mono" style={{ color }}>
                {pct}%
            </span>
        </div>
    );
}

// ─── Modal task card with Magnetic checkbox + Soft Pop + Archive ──────────────

// Замените компонент ModalTaskCard в InfiniteTimeline.tsx на следующий код:

function ModalTaskCard({
    task,
    index,
    epicColor,
}: {
    task: TaskView;
    index: number;
    epicColor: string;
}) {
    const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
    const toggleSubtask = useTaskStore((s) => s.toggleSubtask); // Достаем ваш готовый метод
    
    const liveTask = useTaskStore((s) => s.getTask(task.id)) ?? task;
    const isDone = liveTask.status === "done";
    const cfg = S[liveTask.status];
    const [open, setOpen] = useState(false);
    const [isPopping, setIsPopping] = useState(false);

    const hasSubtasks = liveTask.subtasks.length > 0;
    const donePct = liveTask.progress.total > 0
        ? Math.round((liveTask.progress.done / liveTask.progress.total) * 100) : 0;

    const handleToggleDone = useCallback(() => {
        setIsPopping(true);
        setTimeout(() => {
            // Стор сам автоматически завершит все подзадачи, если статус перейдет в "done"
            updateTaskStatus(liveTask.id, isDone ? "todo" : "done");
            setIsPopping(false);
        }, 140);
    }, [isDone, liveTask.id, updateTaskStatus]);

    const rowRef = useRef<HTMLDivElement>(null);

    return (
        <motion.div
            layout
            layoutId={`task-${liveTask.id}`}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: isPopping ? 1.04 : 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{
                layout: { type: "spring", stiffness: 280, damping: 28 },
                scale: { type: "spring", stiffness: 400, damping: 25 },
                opacity: { duration: 0.25, delay: index * 0.02 },
                y: { type: "spring", stiffness: 300, damping: 30, delay: index * 0.02 },
            }}
            className="rounded-xl overflow-hidden relative"
            style={{
                background: "var(--glass-01)",
                border: `1px solid ${isDone ? "rgba(52,211,153,0.12)" : "var(--glass-border)"}`,
                boxShadow: isDone ? `0 0 12px rgba(52,211,153,0.06)` : "none",
            }}
            ref={rowRef}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === " ") { e.preventDefault(); handleToggleDone(); }
            }}
        >
            <AnimatePresence>
                {isDone && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 pointer-events-none rounded-xl"
                        style={{
                            background: "linear-gradient(135deg, rgba(52,211,153,0.04) 0%, transparent 60%)",
                            borderLeft: "2px solid rgba(52,211,153,0.25)",
                        }}
                    />
                )}
            </AnimatePresence>

            <div
                className="flex items-center gap-2.5 px-3 py-2.5"
                style={{ cursor: hasSubtasks ? "pointer" : "default" }}
                onClick={() => hasSubtasks && setOpen((p) => !p)}
            >
                <div onClick={(e) => e.stopPropagation()}>
                    <MagneticCheckbox
                        checked={isDone}
                        onChange={handleToggleDone}
                        size="sm"
                        accentColor={isDone ? "#34d399" : epicColor}
                    />
                </div>

                <div className="flex-1 min-w-0 relative">
                    <span
                        className="text-sm block min-w-0 truncate transition-colors duration-300"
                        style={{ color: isDone ? "var(--text-muted)" : "var(--text-secondary)" }}
                    >
                        {liveTask.title}
                    </span>
                    <AnimatePresence>
                        {isDone && (
                            <motion.div
                                key="strike"
                                initial={{ scaleX: 0, originX: 0 }}
                                animate={{ scaleX: 1 }}
                                exit={{ scaleX: 0 }}
                                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute top-1/2 left-0 right-0 h-px pointer-events-none"
                                style={{
                                    background: "rgba(52,211,153,0.55)",
                                    marginTop: -0.5,
                                }}
                            />
                        )}
                    </AnimatePresence>
                </div>

                {hasSubtasks && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-02)" }}>
                            <motion.div
                                className="h-full rounded-full"
                                animate={{ width: `${donePct}%` }}
                                transition={{ duration: 0.5 }}
                                style={{ backgroundColor: cfg.color }}
                            />
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                            {liveTask.progress.done}/{liveTask.progress.total}
                        </span>
                    </div>
                )}

                {liveTask.assignees.length > 0 && (
                    <div className="flex -space-x-1 shrink-0">
                        {liveTask.assignees.slice(0, 3).map((a) => (
                            <div
                                key={a.id}
                                title={a.roleMeta.label}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white ring-1 ring-[var(--bg-elevated)]"
                                style={{ backgroundColor: a.roleMeta.hex }}
                            >
                                {a.initials}
                            </div>
                        ))}
                    </div>
                )}

                {liveTask.dueDate && (
                    <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
                        {formatDate(liveTask.dueDate)}
                    </span>
                )}

                <motion.span
                    layout
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                    animate={{
                        background: isDone ? S.done.bg : cfg.bg,
                        color: isDone ? S.done.color : cfg.color,
                    }}
                    transition={{ duration: 0.3 }}
                >
                    {isDone ? S.done.label : cfg.label}
                </motion.span>

                {hasSubtasks && (
                    <svg
                        className="w-3 h-3 shrink-0 transition-transform duration-200"
                        style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : "rotate(0)" }}
                        viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                    >
                        <path d="M4 2l4 4-4 4" />
                    </svg>
                )}
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                        style={{ borderTop: "1px solid var(--glass-border)" }}
                    >
                        <div className="px-3 py-2.5">
                            <div className="ml-4 space-y-0.5 border-l-2 pl-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                                {liveTask.subtasks.map((st) => (
                                    <div 
                                        key={st.id} 
                                        className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-md cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Вызываем toggleSubtask из стора 
                                            toggleSubtask(liveTask.id, st.id, st.isCompleted);
                                        }}
                                    >
                                        <div
                                            className="w-4 h-4 rounded-[4px] shrink-0 flex items-center justify-center transition-colors duration-200"
                                            style={{
                                                background: st.isCompleted ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.05)",
                                                border: `1px solid ${st.isCompleted ? "#34d399" : "rgba(255,255,255,0.15)"}`,
                                            }}
                                        >
                                            <AnimatePresence>
                                                {st.isCompleted && (
                                                    <motion.svg 
                                                        initial={{ scale: 0.5, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        exit={{ scale: 0.5, opacity: 0 }}
                                                        className="w-2.5 h-2.5" 
                                                        viewBox="0 0 8 8" 
                                                        fill="none"
                                                        stroke="#34d399" 
                                                        strokeWidth="1.5" 
                                                        strokeLinecap="round" 
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M1.5 4L3 5.5L6.5 2" />
                                                    </motion.svg>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                        <span
                                            className="text-xs flex-1 min-w-0 truncate transition-all duration-300"
                                            style={{
                                                color: st.isCompleted ? "var(--text-muted)" : "var(--text-secondary)",
                                                textDecoration: st.isCompleted ? "line-through" : "none",
                                            }}
                                        >
                                            {st.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Shiny Epic Bar ───────────────────────────────────────────────────────────

function EpicBar({
    bar,
    hovered,
    onHover,
    onClick,
}: {
    bar: Bar;
    hovered: boolean;
    onHover: (v: boolean) => void;
    onClick: () => void;
}) {
    const { epic, barX, barW, pct, hasDates, overdue } = bar;
    const donePct = Math.round(pct * 100);
    const accentColor = overdue ? "#f87171" : epic.color;

    // Aurora Pointer Effect
    const { shineStyle, auroraStyle, onMouseMove, onMouseLeave: shineLeave } = useShinyEffect({
        accentColor,
        intensity: 0.09,
        auroraIntensity: 0.14,
        stiffness: 300,
        damping: 22,
    });

    const handleMouseLeave = () => {
        onHover(false);
        shineLeave();
    };

    return (
        <motion.div
            className="absolute top-1/2 -translate-y-1/2 rounded-lg overflow-hidden"
            style={{
                left: barX,
                width: barW,
                height: LANE_H - 20,
                cursor: "pointer",
                background: hovered ? `${accentColor}1c` : `${accentColor}0e`,
                border: `1px solid ${accentColor}${hovered ? "55" : "28"}`,
                pointerEvents: "auto",
            }}
            animate={{
                boxShadow: hovered ? `0 0 20px ${accentColor}28, 0 4px 16px rgba(0,0,0,0.3)` : "none",
            }}
            transition={{ duration: 0.18 }}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={handleMouseLeave}
            onMouseMove={onMouseMove}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onPointerDown={(e) => { e.stopPropagation(); }}
        >
            {/* Aurora shine layers */}
            <motion.div className="absolute inset-0 pointer-events-none" style={shineStyle} />
            <motion.div className="absolute inset-0 pointer-events-none" style={auroraStyle} />

            {/* Top accent stripe */}
            <div
                className="absolute top-0 left-0 right-0"
                style={{ height: 2, background: accentColor, opacity: hovered ? 0.85 : 0.45 }}
            />

            {/* Progress fill */}
            {pct > 0 && (
                <div
                    className="absolute inset-y-0 left-0 rounded-l-lg"
                    style={{
                        width: `${donePct}%`,
                        background: `${accentColor}1a`,
                        borderRight: `1px solid ${accentColor}30`,
                        transition: "width 0.5s ease",
                    }}
                />
            )}

            {/* Bar info — only when not hovering */}
            {!hovered && (
                <div className="relative h-full flex flex-col justify-center px-2.5 overflow-hidden">
                    <span className="text-[11px] font-semibold font-mono leading-tight" style={{ color: accentColor }}>
                        {donePct}%{overdue ? " · просроч." : ""}
                    </span>
                    {hasDates && epic.endDate && barW >= 120 && (
                        <span className="text-[9px] font-mono leading-tight mt-0.5"
                            style={{ color: "rgba(255,255,255,0.25)" }}>
                            {epic.startDate ? formatDate(epic.startDate) : "?"} → {formatDate(epic.endDate)}
                        </span>
                    )}
                </div>
            )}

            {/* Hover CTA */}
            {hovered && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative h-full flex items-center justify-center gap-1.5"
                >
                    <span className="text-[11px] font-medium font-mono" style={{ color: accentColor }}>
                        подробнее
                    </span>
                    <svg className="w-3 h-3" style={{ color: accentColor }}
                        viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 6h8M6 2l4 4-4 4" />
                    </svg>
                </motion.div>
            )}
        </motion.div>
    );
}

// ─── MODAL with task archive ──────────────────────────────────────────────────

function EpicModal({ epic, onClose }: { epic: EpicWithTasks; onClose: () => void }) {
    // Always read live tasks from store
    const liveEpic = useTaskStore((s) => s.getEpic(epic.id)) ?? epic;
    const pct = liveEpic.progress.total > 0
        ? Math.round((liveEpic.progress.done / liveEpic.progress.total) * 100) : 0;

    const byStatus = useMemo(() => {
        const g: Record<TaskStatus, TaskView[]> = { in_progress: [], todo: [], blocked: [], done: [] };
        for (const t of liveEpic.tasks) g[t.status]?.push(t);
        return g;
    }, [liveEpic]);

    const [filter, setFilter] = useState<TaskStatus | "all">("all");

    // Split active vs archived for fluid layout
    const activeTasks = useMemo(() => {
        const active = STATUS_ORDER.filter((s) => s !== "done").flatMap((s) => byStatus[s]);
        if (filter === "all") return active;
        if (filter === "done") return [];
        return byStatus[filter];
    }, [filter, byStatus]);

    const archivedTasks = useMemo(() => {
        if (filter !== "all" && filter !== "done") return [];
        return byStatus["done"];
    }, [filter, byStatus]);

    const showArchive = archivedTasks.length > 0 && (filter === "all" || filter === "done");

    useEffect(() => {
        const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [onClose]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
                style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <motion.div
                    key="panel"
                    initial={{ opacity: 0, scale: 0.94, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 20 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full flex flex-col"
                    style={{
                        maxWidth: 640,
                        maxHeight: "88vh",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: 20,
                        boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${liveEpic.color}18`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ── Header ── */}
                    <div
                        className="shrink-0 px-5 pt-5 pb-4"
                        style={{
                            borderBottom: "1px solid var(--glass-border)",
                            background: `linear-gradient(135deg, ${liveEpic.color}0e 0%, transparent 55%)`,
                            borderRadius: "20px 20px 0 0",
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base font-bold font-mono"
                                style={{
                                    background: `${liveEpic.color}1a`,
                                    border: `1.5px solid ${liveEpic.color}45`,
                                    color: liveEpic.color,
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

                        {/* Progress bar */}
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
                            {/* Status breakdown strip */}
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

                    {/* ── Filter tabs ── */}
                    <div
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto"
                        style={{ borderBottom: "1px solid var(--glass-border)" }}
                    >
                        <button
                            onClick={() => setFilter("all")}
                            className="px-3 py-1 rounded-lg text-[11px] font-mono font-medium transition-all shrink-0"
                            style={{
                                background: filter === "all" ? `${liveEpic.color}20` : "var(--glass-01)",
                                color: filter === "all" ? liveEpic.color : "var(--text-muted)",
                                border: filter === "all" ? `1px solid ${liveEpic.color}40` : "1px solid var(--glass-border)",
                            }}
                        >
                            Все · {liveEpic.tasks.length}
                        </button>
                        {STATUS_ORDER.map((s) => {
                            const n = byStatus[s].length;
                            if (!n) return null;
                            return (
                                <button
                                    key={s}
                                    onClick={() => setFilter(s)}
                                    className="px-3 py-1 rounded-lg text-[11px] font-mono font-medium transition-all shrink-0"
                                    style={{
                                        background: filter === s ? S[s].bg : "var(--glass-01)",
                                        color: filter === s ? S[s].color : "var(--text-muted)",
                                        border: filter === s ? `1px solid ${S[s].color}40` : "1px solid var(--glass-border)",
                                    }}
                                >
                                    {S[s].label} · {n}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Task list with fluid archive ── */}
                    <div
                        className="flex-1 overflow-y-auto px-4 py-3"
                        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
                    >
                        <LayoutGroup id={`epic-tasks-${liveEpic.id}`}>
                            {/* Active tasks */}
                            <motion.div layout className="space-y-2">
                                <AnimatePresence mode="popLayout">
                                    {activeTasks.length === 0 && archivedTasks.length === 0 ? (
                                        <motion.div
                                            key="empty"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex flex-col items-center py-12 gap-3"
                                        >
                                            <span className="text-4xl opacity-20">📋</span>
                                            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Нет задач</p>
                                        </motion.div>
                                    ) : (
                                        activeTasks.map((task, i) => (
                                            <ModalTaskCard
                                                key={task.id}
                                                task={task}
                                                index={i}
                                                epicColor={liveEpic.color}
                                            />
                                        ))
                                    )}
                                </AnimatePresence>
                            </motion.div>

                            {/* Archive divider + completed tasks */}
                            <AnimatePresence>
                                {showArchive && (
                                    <motion.div
                                        key="archive-section"
                                        layout
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                        className="overflow-hidden"
                                    >
                                        {/* Divider */}
                                        <div className="flex items-center gap-3 mt-4 mb-3">
                                            <div className="flex-1 h-px" style={{ background: "rgba(52,211,153,0.15)" }} />
                                            <span
                                                className="text-[10px] font-mono px-2.5 py-1 rounded-full"
                                                style={{
                                                    background: "rgba(52,211,153,0.08)",
                                                    color: "#34d399",
                                                    border: "1px solid rgba(52,211,153,0.2)",
                                                }}
                                            >
                                                Выполнено · {archivedTasks.length}
                                            </span>
                                            <div className="flex-1 h-px" style={{ background: "rgba(52,211,153,0.15)" }} />
                                        </div>

                                        <motion.div layout className="space-y-2">
                                            <AnimatePresence mode="popLayout">
                                                {archivedTasks.map((task, i) => (
                                                    <ModalTaskCard
                                                        key={task.id}
                                                        task={task}
                                                        index={i}
                                                        epicColor={liveEpic.color}
                                                    />
                                                ))}
                                            </AnimatePresence>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </LayoutGroup>
                    </div>

                    {/* ── Footer ── */}
                    <div
                        className="shrink-0 px-5 py-3 flex justify-between items-center"
                        style={{
                            borderTop: "1px solid var(--glass-border)",
                            borderRadius: "0 0 20px 20px",
                            background: "rgba(255,255,255,0.012)",
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
                                color: liveEpic.color,
                                border: `1px solid ${liveEpic.color}30`,
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export function InfiniteTimeline() {
    const epics = useTaskStore((s) => s.epics);
    const layout = useMemo(() => buildLayout(epics), [epics]);

    const [modalId, setModalId] = useState<number | null>(null);
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const modalEpic = useMemo(() => epics.find((e) => e.id === modalId) ?? null, [epics, modalId]);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Centre on today on mount
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        requestAnimationFrame(() => {
            el.scrollLeft = Math.max(0, layout.todayX - el.clientWidth / 2 + LEFT_W);
        });
    }, [layout.todayX]);

    // Drag-to-pan
    const dragging = useRef(false);
    const dragStart = useRef({ x: 0, scroll: 0 });
    const [isDrag, setIsDrag] = useState(false);
    const moved = useRef(false);

    const onPD = useCallback((e: React.PointerEvent) => {
        dragging.current = true;
        moved.current = false;
        dragStart.current = { x: e.clientX, scroll: scrollRef.current?.scrollLeft ?? 0 };
        setIsDrag(true);
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }, []);

    const onPM = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return;
        const dx = dragStart.current.x - e.clientX;
        // Увеличиваем порог до 10px для более стабильного клика
        if (Math.abs(dx) > 10) moved.current = true;

        if (scrollRef.current) scrollRef.current.scrollLeft = dragStart.current.scroll + dx;
    }, []);

    const onPU = useCallback(() => { dragging.current = false; setIsDrag(false); }, []);

    // Stats
    const totalTasks = epics.reduce((s, e) => s + e.progress.total, 0);
    const doneTasks = epics.reduce((s, e) => s + e.progress.done, 0);
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
            {/* ── Widget header ── */}
            <div
                className="flex items-center gap-3 px-5 py-3 shrink-0"
                style={{ borderBottom: "1px solid var(--glass-border)" }}
            >
                <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.28)" }}
                >
                    <svg className="w-4 h-4" style={{ color: "#8b5cf6" }} viewBox="0 0 16 16" fill="none"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 4h8M2 8h12M2 12h6" />
                    </svg>
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Хронолента</p>
                    <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                        {epics.length} эпиков · {totalTasks} задач
                    </p>
                </div>

                <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-02)" }}>
                        <motion.div
                            className="h-full rounded-full"
                            animate={{ width: `${overallPct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            style={{ background: "linear-gradient(90deg, #8b5cf6, #34d399)" }}
                        />
                    </div>
                    <span className="text-xs font-bold font-mono" style={{ color: "#34d399" }}>{overallPct}%</span>
                </div>

                <div className="w-px h-5 shrink-0" style={{ background: "var(--glass-border)" }} />

                <div className="hidden md:flex items-center gap-3 shrink-0">
                    {STATUS_ORDER.map((s) => (
                        <div key={s} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: S[s].color }} />
                            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                                {S[s].label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Gantt area ── */}
            <div
                ref={scrollRef}
                className="relative overflow-auto"
                style={{
                    maxHeight: MAX_AREA_H,
                    cursor: isDrag ? "grabbing" : "grab",
                    userSelect: "none",
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.08) transparent",
                }}
                onPointerDown={onPD}
                onPointerMove={onPM}
                onPointerUp={onPU}
                onPointerLeave={onPU}
            >
                <div style={{ minWidth: LEFT_W + layout.canvasW, position: "relative" }}>

                    {/* ══ STICKY RULER ══ */}
                    <div
                        className="sticky top-0 z-20 flex"
                        style={{
                            height: RULER_H,
                            background: "var(--bg-elevated)",
                            borderBottom: "1px solid rgba(255,255,255,0.07)",
                        }}
                    >
                        <div
                            className="shrink-0 flex items-end px-4 pb-2 sticky left-0 z-30"
                            style={{
                                width: LEFT_W,
                                background: "var(--bg-elevated)",
                                borderRight: "1px solid rgba(255,255,255,0.07)",
                            }}
                        >
                            <span className="text-[9px] font-mono uppercase tracking-widest"
                                style={{ color: "var(--text-muted)" }}>
                                Эпик
                            </span>
                        </div>

                        <div className="relative flex-1">
                            {layout.months.map(({ x, label, isJan }) => (
                                <div
                                    key={`m-${x}`}
                                    className="absolute top-0 bottom-0 flex items-end pb-2 pl-2"
                                    style={{ left: x }}
                                >
                                    <span
                                        className="text-[11px] font-mono whitespace-nowrap capitalize"
                                        style={{
                                            color: isJan ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.22)",
                                            fontWeight: isJan ? 600 : 400,
                                        }}
                                    >
                                        {label}
                                    </span>
                                </div>
                            ))}

                            {/* TODAY pill */}
                            <div
                                className="absolute top-0 bottom-0 flex items-center"
                                style={{ left: layout.todayX, transform: "translateX(-50%)", zIndex: 10 }}
                            >
                                <span
                                    className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                                    style={{
                                        background: "#7c3aed",
                                        color: "white",
                                        boxShadow: "0 0 10px rgba(124,58,237,0.5)",
                                    }}
                                >
                                    СЕГОДНЯ
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ══ BACKGROUND: month lines + today line ══ */}
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
                                    background: isJan ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
                                }}
                            />
                        ))}
                        <div
                            className="absolute top-0 bottom-0"
                            style={{ left: layout.todayX, width: 1.5, background: "rgba(124,58,237,0.45)" }}
                        />
                    </div>

                    {/* ══ EPIC ROWS ══ */}
                    {layout.bars.map((bar, idx) => {
                        const { epic, pct, overdue } = bar;
                        const isHovered = hoveredId === epic.id;
                        const donePct = Math.round(pct * 100);
                        const accentColor = overdue ? "#f87171" : epic.color;

                        return (
                            <div
                                key={epic.id}
                                className="flex relative"
                                style={{
                                    height: LANE_H,
                                    background: idx % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
                                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                                    zIndex: 1,
                                }}
                            >
                                {/* ── Sticky label ── */}
                                <div
                                    className="shrink-0 sticky left-0 z-10 flex items-center gap-2 px-3"
                                    style={{
                                        width: LEFT_W,
                                        background: isHovered
                                            ? `linear-gradient(90deg, ${accentColor}12, ${idx % 2 === 0 ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.06)"})`
                                            : idx % 2 === 0 ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.06)",
                                        borderRight: "1px solid rgba(255,255,255,0.05)",
                                        transition: "background 0.18s",
                                    }}
                                >
                                    <div
                                        className="w-0.5 self-stretch my-2.5 rounded-full shrink-0 transition-opacity"
                                        style={{ backgroundColor: accentColor, opacity: isHovered ? 1 : 0.4 }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className="text-[11px] font-medium leading-tight truncate"
                                            style={{
                                                color: isHovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
                                                transition: "color 0.18s",
                                            }}
                                        >
                                            {epic.title}
                                        </p>
                                        <p className="text-[9px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                                            {epic.progress.done}/{epic.progress.total}
                                        </p>
                                    </div>
                                    <span
                                        className="text-[10px] font-bold font-mono shrink-0 transition-colors"
                                        style={{ color: `${accentColor}${isHovered ? "ff" : "70"}` }}
                                    >
                                        {donePct}%
                                    </span>
                                </div>

                                {/* ── Bar area ── */}
                                <div className="relative flex-1">
                                    {isHovered && (
                                        <div
                                            className="absolute inset-0 pointer-events-none"
                                            style={{ background: `${accentColor}07` }}
                                        />
                                    )}
                                    <EpicBar
                                        bar={bar}
                                        hovered={isHovered}
                                        onHover={(v) => setHoveredId(v ? epic.id : null)}
                                        onClick={() => {
                                            setModalId(epic.id);
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Footer ── */}
            <div
                className="shrink-0 flex items-center gap-4 px-5 py-2"
                style={{ borderTop: "1px solid var(--glass-border)", background: "rgba(255,255,255,0.01)" }}
            >
                <div className="flex items-center gap-4 flex-1">
                    {[
                        { key: "drag", icon: "⟺", text: "Перетащите" },
                        { key: "click", icon: "↗", text: "Клик → задачи" },
                        { key: "space", icon: "Space", text: "Отметить" },
                    ].map(({ key, icon, text }) => (
                        <div key={key} className="flex items-center gap-1 text-[10px] font-mono"
                            style={{ color: "var(--text-muted)" }}>
                            <span>{icon}</span><span>{text}</span>
                        </div>
                    ))}
                </div>
                <div className="hidden sm:flex items-center gap-3">
                    {STATUS_ORDER.map((s) => {
                        const n = statusCounts[s];
                        if (!n) return null;
                        return (
                            <div key={s} className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: S[s].color }} />
                                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{n}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Modal ── */}
            <AnimatePresence>
                {modalEpic && (
                    <EpicModal
                        key={modalEpic.id}
                        epic={modalEpic}
                        onClose={() => setModalId(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}