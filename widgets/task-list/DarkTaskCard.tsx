"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatDate } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { TaskView, TaskStatus } from "@/shared/types";

const STATUS_CFG: Record<TaskStatus, { label: string; bg: string; text: string }> = {
    todo: { label: "К работе", bg: "rgba(100,116,139,0.18)", text: "#94a3b8" },
    in_progress: { label: "В работе", bg: "rgba(14,165,233,0.18)", text: "#38bdf8" },
    done: { label: "Готово", bg: "rgba(16,185,129,0.18)", text: "#34d399" },
    blocked: { label: "Заблокировано", bg: "rgba(239,68,68,0.18)", text: "#f87171" },
};

const PRIORITY_COLOR: Record<string, string> = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#475569",
};

interface Props {
    task: TaskView;
    epicColor?: string;
    onOpen?: (task: TaskView) => void;
}

export function DarkTaskCard({ task, epicColor, onOpen }: Props) {
    const [subtasksOpen, setSubtasksOpen] = useState(false);
    const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
    const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
    const liveTask = useTaskStore((s) => s.getTask(task.id)) ?? task;

    const { label, bg, text } = STATUS_CFG[liveTask.status];
    const priorityColor = PRIORITY_COLOR[liveTask.priority];
    const progressPct =
        liveTask.subtasks.length > 0
            ? (liveTask.progress.done / liveTask.progress.total) * 100
            : 0;

    function cycleStatus(e: React.MouseEvent) {
        e.stopPropagation();
        const order: TaskStatus[] = ["todo", "in_progress", "done"];
        const next = order[(order.indexOf(liveTask.status as TaskStatus) + 1) % order.length];
        updateTaskStatus(liveTask.id, next);
    }

    return (
        <motion.div
            whileHover={{ y: -1, boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}
            transition={{ duration: 0.15 }}
            data-priority={liveTask.priority}
            className="relative rounded-xl overflow-hidden cursor-pointer"
            style={{
                background: "var(--bg-overlay)",
                border: "1px solid var(--glass-border)",
            }}
            onClick={() => onOpen?.(liveTask)}
        >
            {/* Тонкая полоска цвета эпика сверху */}
            {epicColor && (
                <div
                    className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg, ${epicColor}80, transparent)` }}
                />
            )}

            <div className="px-3.5 py-3 space-y-2.5">
                {/* Row 1: статус + дедлайн */}
                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={cycleStatus}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity shrink-0"
                        style={{ backgroundColor: bg, color: text }}
                    >
                        <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: priorityColor }}
                        />
                        {label}
                    </button>
                    {liveTask.dueDate && (
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                            {formatDate(liveTask.dueDate)}
                        </span>
                    )}
                </div>

                {/* Row 2: заголовок */}
                <p
                    className={cn(
                        "text-sm font-medium leading-snug",
                        liveTask.status === "done"
                            ? "line-through"
                            : ""
                    )}
                    style={{
                        color:
                            liveTask.status === "done"
                                ? "var(--text-muted)"
                                : "var(--text-primary)",
                    }}
                >
                    {liveTask.title}
                </p>

                {/* Row 3: описание */}
                {liveTask.description && (
                    <p
                        className="text-xs line-clamp-2 leading-relaxed"
                        style={{ color: "var(--text-muted)" }}
                    >
                        {liveTask.description}
                    </p>
                )}

                {/* Row 4: ответственные + прогресс-кнопка */}
                <div className="flex items-center justify-between gap-2">
                    {/* Аватарки */}
                    <div className="flex items-center -space-x-1.5">
                        {liveTask.assignees.slice(0, 3).map((a, i) => (
                            <div
                                key={a.id}
                                title={`${a.name} — ${a.roleMeta.label}`}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-1 shrink-0 ring-[var(--bg-overlay)]" style={{
                                    backgroundColor: a.roleMeta.hex,
                                    zIndex: 3 - i,
                                }}
                            >
                                {a.initials}
                            </div>
                        ))}
                        {liveTask.assignees.length > 0 && (
                            <span
                                className="pl-3 text-xs truncate max-w-[120px]"
                                style={{ color: "var(--text-muted)" }}
                            >
                                {liveTask.assignees[0].roleMeta.label}
                                {liveTask.assignees.length > 1 &&
                                    ` +${liveTask.assignees.length - 1}`}
                            </span>
                        )}
                    </div>

                    {/* Подзадачи */}
                    {liveTask.subtasks.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSubtasksOpen((v) => !v);
                            }}
                            className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity shrink-0"
                            style={{ color: "var(--text-muted)" }}
                        >
                            <span className="font-mono">
                                {liveTask.progress.done}/{liveTask.progress.total}
                            </span>
                            <motion.svg
                                className="w-3 h-3"
                                viewBox="0 0 12 12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                animate={{ rotate: subtasksOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <path d="M2 4l4 4 4-4" />
                            </motion.svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Прогресс-бар подзадач */}
            {liveTask.subtasks.length > 0 && (
                <div
                    className="mx-3.5 mb-2 h-0.5 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                >
                    <motion.div
                        className="h-full rounded-full"
                        style={{
                            backgroundColor: priorityColor,
                            boxShadow: `0 0 6px ${priorityColor}60`,
                        }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
            )}

            {/* Раскрывающийся список подзадач */}
            <AnimatePresence>
                {subtasksOpen && liveTask.subtasks.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="px-3.5 pt-2 pb-3 space-y-1"
                            style={{ borderTop: "1px solid var(--glass-border)" }}
                        >
                            {liveTask.subtasks.map((st) => (
                                <label
                                    key={st.id}
                                    className="flex items-center gap-2.5 py-1 cursor-pointer group"
                                >
                                    {/* Кастомный чекбокс */}
                                    <div
                                        onClick={() =>
                                            toggleSubtask(liveTask.id, st.id, st.isCompleted)
                                        }
                                        className={cn(
                                            "w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-all duration-200",
                                            st.isCompleted
                                                ? "border-[var(--accent-500)] bg-[var(--accent-500)] shadow-[0_0_6px_var(--accent-glow)]"
                                                : "border-[var(--glass-border-active)] bg-transparent group-hover:border-[var(--accent-500)]"
                                        )}
                                    >
                                        <AnimatePresence>
                                            {st.isCompleted && (
                                                <motion.svg
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    exit={{ scale: 0 }}
                                                    transition={{ duration: 0.12, ease: "backOut" }}
                                                    className="w-2 h-2 text-white"
                                                    viewBox="0 0 8 8"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M1 4l2 2 4-4" />
                                                </motion.svg>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <span
                                        className={cn(
                                            "text-xs leading-relaxed transition-colors duration-200",
                                            st.isCompleted
                                                ? "line-through"
                                                : "group-hover:text-[var(--text-primary)]"
                                        )}
                                        style={{
                                            color: st.isCompleted
                                                ? "var(--text-muted)"
                                                : "var(--text-secondary)",
                                        }}
                                    >
                                        {st.title}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}