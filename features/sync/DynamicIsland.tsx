"use client";
/**
 * @file DynamicIsland.tsx — widgets/notifications
 *
 * ═══════════════════════════════════════════════════════════════
 * DYNAMIC ISLAND — МОРФИРУЮЩИЙ НОТИФИКАТОР
 * ═══════════════════════════════════════════════════════════════
 *
 * КОНЦЕПЦИЯ:
 *
 *  Apple Dynamic Island (2022) доказал: нотификации не должны прерывать
 *  пользователя. Они должны «вырастать» из существующего UI-элемента,
 *  передавать информацию, и «схлопываться» обратно.
 *
 *  Наша адаптация для B2B Task Manager:
 *  — Островок живёт в центре верхней части экрана
 *  — В покое — минимальная таблетка (скрыта или показывает статус)
 *  — При событии — разворачивается в информативный блок
 *  — Через 3.5 секунды схлопывается обратно
 *
 * FRAMER MOTION layout PROP:
 *  Ключевая технология — Framer Motion Auto Layout Animation.
 *  Достаточно изменить содержимое div'а, а LayoutGroup + layout prop
 *  автоматически анимируют изменение размера через FLIP-технику
 *  (First, Last, Invert, Play) — 60fps без transform-origin tricks.
 *
 * ТИПЫ НОТИФИКАЦИЙ:
 *  - task_update     — изменение статуса задачи
 *  - subtask_done    — выполнение подзадачи
 *  - sync_success    — успешная синхронизация
 *  - sync_error      — ошибка синхронизации
 *  - zen_available   — напоминание о Zen Mode при очереди задач
 *
 * UX-ПРИНЦИПЫ:
 *  1. Не блокируй контент (fixed позиционирование, не overlay)
 *  2. Brevity — максимум 2 строки текста
 *  3. Tempo — появление 200ms, чтение 3.5s, исчезновение 300ms
 *  4. Color coding — каждый тип имеет свой цвет (не более 4)
 */

import {
    useState,
    useCallback,
    useEffect,
    useRef,
    useLayoutEffect,
} from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { create } from "zustand";
import { cn } from "@/shared/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
    | "task_update"
    | "subtask_done"
    | "sync_success"
    | "sync_error"
    | "zen_available"
    | "info";

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    body?: string;
    icon?: string;       // emoji или SVG key
    color?: string;      // override цвета
    duration?: number;   // ms, default 3500
    action?: {
        label: string;
        onAction: () => void;
    };
}

// ─── Notification Store ───────────────────────────────────────────────────────

interface NotificationStore {
    queue: Notification[];
    current: Notification | null;
    push: (n: Omit<Notification, "id">) => void;
    dismiss: () => void;
    _next: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    queue: [],
    current: null,

    push: (n) => {
        const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const notification = { ...n, id };

        set((s) => {
            // Если уже показываем — добавляем в очередь
            if (s.current) {
                return { queue: [...s.queue, notification] };
            }
            return { current: notification };
        });
    },

    dismiss: () => {
        get()._next();
    },

    _next: () => {
        set((s) => {
            const [next, ...rest] = s.queue;
            return { current: next ?? null, queue: rest };
        });
    },
}));

/**
 * Convenience hook для отправки нотификаций из любого компонента.
 */
export function useNotify() {
    const push = useNotificationStore((s) => s.push);

    return useCallback(
        (n: Omit<Notification, "id">) => push(n),
        [push]
    );
}

// ─── Type Config ──────────────────────────────────────────────────────────────

const TYPE_CFG: Record<NotificationType, { color: string; bg: string; border: string; icon: string }> = {
    task_update: {
        color: "#38bdf8",
        bg: "rgba(56,189,248,0.1)",
        border: "rgba(56,189,248,0.2)",
        icon: "✦",
    },
    subtask_done: {
        color: "#34d399",
        bg: "rgba(52,211,153,0.1)",
        border: "rgba(52,211,153,0.2)",
        icon: "✓",
    },
    sync_success: {
        color: "#34d399",
        bg: "rgba(52,211,153,0.08)",
        border: "rgba(52,211,153,0.18)",
        icon: "⟳",
    },
    sync_error: {
        color: "#f87171",
        bg: "rgba(248,113,113,0.1)",
        border: "rgba(248,113,113,0.2)",
        icon: "⚠",
    },
    zen_available: {
        color: "#a78bfa",
        bg: "rgba(139,92,246,0.12)",
        border: "rgba(139,92,246,0.25)",
        icon: "◈",
    },
    info: {
        color: "#94a3b8",
        bg: "rgba(100,116,139,0.1)",
        border: "rgba(100,116,139,0.2)",
        icon: "ℹ",
    },
};

// ─── Island Pill (collapsed state) ────────────────────────────────────────────

function IslandPill() {
    return (
        <div
            className="flex items-center gap-1.5"
            style={{ padding: "6px 14px" }}
        >
            <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "#8b5cf6" }}
                animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <span
                className="text-[11px] font-mono"
                style={{ color: "rgba(255,255,255,0.3)" }}
            >
                TaskFlow
            </span>
        </div>
    );
}

// ─── Island Expanded ──────────────────────────────────────────────────────────

function IslandExpanded({
    notification,
    onDismiss,
    progress,
}: {
    notification: Notification;
    onDismiss: () => void;
    progress: number; // 0–1 (для прогресс-бара авто-dismiss)
}) {
    const cfg = TYPE_CFG[notification.type];
    const color = notification.color ?? cfg.color;
    const icon = notification.icon ?? cfg.icon;

    return (
        <div
            style={{
                padding: "10px 16px 12px",
                minWidth: 280,
                maxWidth: 380,
            }}
        >
            {/* Top row: icon + title + close */}
            <div className="flex items-center gap-2.5">
                {/* Icon */}
                <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.1, duration: 0.3, ease: "backOut" }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 font-bold"
                    style={{
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                        color,
                    }}
                >
                    {icon}
                </motion.div>

                {/* Text */}
                <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 }}
                    className="flex-1 min-w-0"
                >
                    <p
                        className="text-xs font-semibold leading-tight truncate"
                        style={{ color: "rgba(255,255,255,0.9)" }}
                    >
                        {notification.title}
                    </p>
                    {notification.body && (
                        <p
                            className="text-[11px] mt-0.5 leading-tight line-clamp-2"
                            style={{ color: "rgba(255,255,255,0.4)" }}
                        >
                            {notification.body}
                        </p>
                    )}
                </motion.div>

                {/* Close */}
                <button
                    onClick={onDismiss}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md transition-all"
                    style={{ color: "rgba(255,255,255,0.2)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.2)"; }}
                >
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2l8 8M10 2l-8 8" />
                    </svg>
                </button>
            </div>

            {/* Action button */}
            {notification.action && (
                <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-2.5 flex justify-end"
                >
                    <button
                        onClick={() => { notification.action!.onAction(); onDismiss(); }}
                        className="text-[11px] font-medium px-3 py-1 rounded-lg transition-all"
                        style={{
                            background: `${color}18`,
                            border: `1px solid ${color}30`,
                            color,
                        }}
                    >
                        {notification.action.label}
                    </button>
                </motion.div>
            )}

            {/* Auto-dismiss progress line */}
            <div
                className="mt-2.5 h-px rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)" }}
            >
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color, originX: 0 }}
                    animate={{ scaleX: 1 - progress }}
                    transition={{ duration: 0.1, ease: "linear" }}
                />
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DynamicIslandProps {
    /** Показывать ли островок в покое (без нотификаций) */
    showIdle?: boolean;
}

export function DynamicIsland({ showIdle = false }: DynamicIslandProps) {
    const { current, dismiss, _next } = useNotificationStore();
    const [progress, setProgress] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const durationRef = useRef<number>(3500);

    useLayoutEffect(() => {
        if (!current) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setProgress(0);
        }
    }, [current]);

    // Авто-dismiss таймер
    useEffect(() => {
        if (!current) return;

        const duration = current.duration ?? 3500;
        durationRef.current = duration;
        startTimeRef.current = Date.now();

        // Используем requestAnimationFrame для плавности и производительности
        let frameId: number;

        const updateProgress = () => {
            const elapsed = Date.now() - startTimeRef.current;
            const p = Math.min(elapsed / duration, 1);

            setProgress(p);

            if (p < 1) {
                frameId = requestAnimationFrame(updateProgress);
            } else {
                _next();
            }
        };

        frameId = requestAnimationFrame(updateProgress);

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [current, _next]);

    const isExpanded = !!current;

    return (
        <div
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[9998]"
            style={{ pointerEvents: isExpanded || showIdle ? "auto" : "none" }}
        >
            <LayoutGroup>
                <AnimatePresence mode="wait">
                    {(isExpanded || showIdle) && (
                        <motion.div
                            key={isExpanded ? "expanded" : "idle"}
                            layout
                            initial={{ opacity: 0, y: -12, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={{
                                layout: { type: "spring", stiffness: 400, damping: 30 },
                                opacity: { duration: 0.2 },
                                y: { type: "spring", stiffness: 400, damping: 30 },
                                scale: { duration: 0.2 },
                            }}
                            style={{
                                background: "rgba(10,11,20,0.92)",
                                backdropFilter: "blur(20px)",
                                WebkitBackdropFilter: "blur(20px)",
                                border: isExpanded
                                    ? `1px solid ${current ? (TYPE_CFG[current.type].border) : "rgba(255,255,255,0.1)"}`
                                    : "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 999,
                                boxShadow: isExpanded
                                    ? `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${current ? TYPE_CFG[current.type].color : "#8b5cf6"}18`
                                    : "0 4px 16px rgba(0,0,0,0.3)",
                                overflow: "hidden",
                            }}
                        >
                            <motion.div layout>
                                {isExpanded && current ? (
                                    <IslandExpanded
                                        notification={current}
                                        onDismiss={dismiss}
                                        progress={progress}
                                    />
                                ) : (
                                    <IslandPill />
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </LayoutGroup>
        </div>
    );
}

// ─── Zen Mode Trigger Notification ───────────────────────────────────────────

/**
 * Готовая нотификация для приглашения в Zen Mode.
 * Использовать когда очередь задач > 3:
 *   useEffect(() => { if (pendingTasks > 3) notify(zenInvite(activateZen)); }, [...])
 */
export function zenModeInviteNotification(onActivate: () => void): Omit<Notification, "id"> {
    return {
        type: "zen_available",
        title: "Zen Mode доступен",
        body: `Сосредоточьтесь на одной задаче`,
        icon: "◈",
        duration: 5000,
        action: {
            label: "Войти",
            onAction: onActivate,
        },
    };
}