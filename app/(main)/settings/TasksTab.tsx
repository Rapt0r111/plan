"use client";
/**
 * @file TasksTab.tsx — app/(main)/settings
 *
 * РЕФАКТОРИНГ v2:
 *   - Удалён inline AssigneeManager (без оптимистичных обновлений, с комментарием
 *     "For simplicity we just reload; production would use optimistic state")
 *   - Добавлен импорт AssigneeManager из shared/ui — с оптимистичными обновлениями
 *     через Zustand store (addAssignee/removeAssignee + rollback при ошибке)
 *   - Импортированы formatDateInput и formatDateDisplay из shared/lib/utils
 *     вместо локальных дублей
 */
import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatDateInput, formatDateDisplay } from "@/shared/lib/utils";
import { STATUS_META, PRIORITY_META, STATUS_ORDER, PRIORITY_ORDER } from "@/shared/config/task-meta";
import { AssigneeManager } from "@/shared/ui/AssigneeManager"; // ← новый импорт
import type { EpicWithTasks, TaskView, TaskStatus, TaskPriority, UserWithMeta } from "@/shared/types";

interface Props {
    initialEpics: EpicWithTasks[];
    users: UserWithMeta[];
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, onClick }: { status: TaskStatus; onClick?: () => void }) {
    const meta = STATUS_META[status];
    return (
        <button onClick={onClick}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80 shrink-0"
            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
            {meta.label}
        </button>
    );
}

// ─── PriorityBadge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority, onClick }: { priority: TaskPriority; onClick?: () => void }) {
    const meta = PRIORITY_META[priority];
    return (
        <button onClick={onClick}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80 shrink-0"
            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
            {meta.label}
        </button>
    );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({
    task, epics, users, epicColor,
    onUpdate, onDelete,
}: {
    task: TaskView;
    epics: EpicWithTasks[];
    users: UserWithMeta[];
    epicColor: string;
    onUpdate: (patch: Partial<{
        title: string; description: string | null; status: TaskStatus;
        priority: TaskPriority; dueDate: string | null; epicId: number;
    }>) => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [editingDesc, setEditingDesc] = useState(false);
    const [titleDraft, setTitleDraft] = useState(task.title);
    const [descDraft, setDescDraft] = useState(task.description ?? "");
    const [cycleStatus, setCycleStatus] = useState(false);
    const [cyclePriority, setCyclePriority] = useState(false);

    const saveTitle = () => {
        setEditingTitle(false);
        if (titleDraft.trim() && titleDraft.trim() !== task.title) onUpdate({ title: titleDraft.trim() });
        else setTitleDraft(task.title);
    };

    const saveDesc = () => {
        setEditingDesc(false);
        const v = descDraft.trim() || null;
        if (v !== task.description) onUpdate({ description: v });
    };

    return (
        <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl overflow-hidden group"
            style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
                borderLeft: `2px solid ${epicColor}`,
            }}>

            {/* ── Main row ─────────────────────────────────────── */}
            <div className="px-3.5 py-3 space-y-2.5">

                {/* Row 1: status + priority + id */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Status cycle */}
                    <div className="relative">
                        <StatusBadge status={task.status} onClick={() => setCycleStatus((v) => !v)} />
                        <AnimatePresence>
                            {cycleStatus && (
                                <motion.div initial={{ opacity: 0, y: 4, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }}
                                    transition={{ duration: 0.12 }}
                                    className="absolute top-full left-0 mt-1 z-20 rounded-xl overflow-hidden shadow-2xl"
                                    style={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)", minWidth: 140 }}>
                                    {STATUS_ORDER.map((s) => {
                                        const meta = STATUS_META[s as TaskStatus];
                                        return (
                                            <button key={s}
                                                onClick={() => { onUpdate({ status: s as TaskStatus }); setCycleStatus(false); }}
                                                className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--glass-01)] transition-colors",
                                                    task.status === s && "bg-[var(--glass-02)]")}>
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                                                {meta.label}
                                            </button>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Priority cycle */}
                    <div className="relative">
                        <PriorityBadge priority={task.priority} onClick={() => setCyclePriority((v) => !v)} />
                        <AnimatePresence>
                            {cyclePriority && (
                                <motion.div initial={{ opacity: 0, y: 4, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }}
                                    transition={{ duration: 0.12 }}
                                    className="absolute top-full left-0 mt-1 z-20 rounded-xl overflow-hidden shadow-2xl"
                                    style={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)", minWidth: 130 }}>
                                    {PRIORITY_ORDER.map((p) => {
                                        const meta = PRIORITY_META[p as TaskPriority];
                                        return (
                                            <button key={p}
                                                onClick={() => { onUpdate({ priority: p as TaskPriority }); setCyclePriority(false); }}
                                                className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--glass-01)] transition-colors",
                                                    task.priority === p && "bg-[var(--glass-02)]")}>
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                                                {meta.label}
                                            </button>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <span className="ml-auto text-xs font-mono" style={{ color: "var(--text-muted)" }}>#{task.id}</span>

                    {/* Expand toggle */}
                    <button onClick={() => setExpanded((v) => !v)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: "var(--text-muted)", background: "transparent" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--glass-02)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                        <motion.svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none"
                            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                            animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <path d="M2 4l4 4 4-4" />
                        </motion.svg>
                    </button>

                    {/* Delete */}
                    <button onClick={onDelete}
                        className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}>
                        <svg className="w-3 h-3" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" />
                        </svg>
                    </button>
                </div>

                {/* Row 2: title */}
                {editingTitle ? (
                    <input autoFocus value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") { setTitleDraft(task.title); setEditingTitle(false); }
                        }}
                        className="w-full bg-[var(--glass-01)] border border-[var(--accent-500)] rounded-lg px-2 py-0.5 text-sm font-medium outline-none"
                        style={{ color: "var(--text-primary)" }} />
                ) : (
                    <button onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
                        className="group/t w-full text-left flex items-start gap-1">
                        <span className={cn("text-sm font-medium leading-snug",
                            task.status === "done" ? "line-through text-(--text-muted)" : "text-[var(--text-primary)]")}>
                            {task.title}
                        </span>
                        <span className="shrink-0 opacity-0 group-hover/t:opacity-40 text-xs mt-px">✎</span>
                    </button>
                )}

                {/* Row 3: assignees mini */}
                {task.assignees.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        {task.assignees.slice(0, 3).map((a) => (
                            <div key={a.id} title={`${a.name} — ${a.roleMeta.label}`}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                style={{ backgroundColor: a.roleMeta.hex }}>
                                {a.initials}
                            </div>
                        ))}
                        <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                            {task.assignees[0].name}
                            {task.assignees.length > 1 && ` +${task.assignees.length - 1}`}
                        </span>
                    </div>
                )}
            </div>

            {/* ── Expanded details ─────────────────────────────── */}
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                        style={{ borderTop: "1px solid var(--glass-border)" }}>
                        <div className="px-3.5 py-3 space-y-3">

                            {/* Description */}
                            <div>
                                <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                                    Описание
                                </p>
                                {editingDesc ? (
                                    <textarea autoFocus value={descDraft} rows={3}
                                        onChange={(e) => setDescDraft(e.target.value)}
                                        onBlur={saveDesc}
                                        onKeyDown={(e) => { if (e.key === "Escape") { setDescDraft(task.description ?? ""); setEditingDesc(false); } }}
                                        placeholder="Описание задачи..."
                                        className="w-full bg-[var(--glass-01)] border border-[var(--accent-500)] rounded-lg px-2 py-1.5 text-sm outline-none resize-none"
                                        style={{ color: "var(--text-primary)" }} />
                                ) : (
                                    <button onClick={() => { setDescDraft(task.description ?? ""); setEditingDesc(true); }}
                                        className="group/d w-full text-left flex items-start gap-1">
                                        <span className="text-sm leading-relaxed line-clamp-3"
                                            style={{ color: task.description ? "var(--text-secondary)" : "var(--text-muted)" }}>
                                            {task.description || "Добавить описание..."}
                                        </span>
                                        <span className="shrink-0 opacity-0 group-hover/d:opacity-40 text-xs mt-px">✎</span>
                                    </button>
                                )}
                            </div>

                            {/* Due date + Epic + Assignee in grid */}
                            <div className="grid grid-cols-2 gap-3">

                                {/* Due date */}
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                                        Дедлайн
                                    </p>
                                    <input type="date" value={formatDateInput(task.dueDate)}
                                        onChange={(e) => onUpdate({ dueDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : null })}
                                        style={{ colorScheme: "dark", color: "var(--text-primary)" }}
                                        className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-2 py-1 text-xs outline-none focus:border-[var(--accent-500)] transition-colors"
                                    />
                                    {task.dueDate && (
                                        <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                                            {formatDateDisplay(task.dueDate)}
                                        </p>
                                    )}
                                </div>

                                {/* Epic selector */}
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                                        Эпик
                                    </p>
                                    <select value={task.epicId}
                                        onChange={(e) => onUpdate({ epicId: Number(e.target.value) })}
                                        className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-2 py-1 text-xs outline-none focus:border-[var(--accent-500)] transition-colors"
                                        style={{ color: "var(--text-primary)" }}>
                                        {epics.map((ep) => (
                                            <option key={ep.id} value={ep.id}
                                                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                                                {ep.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Assignees — теперь через shared компонент с оптимистичными обновлениями */}
                                <div className="col-span-2">
                                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                                        Исполнители ({task.assignees.length})
                                    </p>
                                    {/* БЫЛО: inline AssigneeManager без оптимистичных обновлений
                                        СТАЛО: shared AssigneeManager с store.addAssignee/removeAssignee */}
                                    <AssigneeManager
                                        taskId={task.id}
                                        assignees={task.assignees}
                                        users={users}
                                    />
                                </div>
                            </div>

                            {/* Subtask progress */}
                            {task.subtasks.length > 0 && (
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>
                                        Подзадачи ({task.progress.done}/{task.progress.total})
                                    </p>
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-02)" }}>
                                        <div className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${task.progress.total > 0 ? (task.progress.done / task.progress.total) * 100 : 0}%`,
                                                backgroundColor: PRIORITY_META[task.priority].color,
                                            }} />
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        {task.subtasks.map((st) => (
                                            <div key={st.id} className="flex items-center gap-2 text-xs"
                                                style={{ color: st.isCompleted ? "var(--text-muted)" : "var(--text-secondary)" }}>
                                                <span className={cn("w-3 h-3 rounded shrink-0 flex items-center justify-center border text-white",
                                                    st.isCompleted ? "bg-(--accent-500) border-(--accent-500)" : "border-[var(--glass-border)]")}>
                                                    {st.isCompleted && <svg className="w-2 h-2" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l2 2 4-4" /></svg>}
                                                </span>
                                                <span className={cn(st.isCompleted && "line-through")}>{st.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── CreateTaskForm ────────────────────────────────────────────────────────────

function CreateTaskForm({
    epics, users, defaultEpicId, onCreated, onCancel,
}: {
    epics: EpicWithTasks[];
    users: UserWithMeta[];
    defaultEpicId: number | null;
    onCreated: (task: TaskView) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState({
        title: "",
        description: "",
        status: "todo" as TaskStatus,
        priority: "medium" as TaskPriority,
        epicId: defaultEpicId ?? (epics[0]?.id ?? 0),
        assigneeId: 0,
        dueDate: "",
    });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit() {
        if (!form.title.trim()) { setErr("Введите название"); return; }
        if (!form.epicId) { setErr("Выберите эпик"); return; }
        setLoading(true); setErr(null);
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    epicId: form.epicId,
                    title: form.title.trim(),
                    description: form.description.trim() || null,
                    status: form.status,
                    priority: form.priority,
                    dueDate: form.dueDate ? `${form.dueDate}T00:00:00.000Z` : null,
                    sortOrder: 9999,
                }),
            });
            const json = await res.json();
            if (!res.ok) { setErr(json.error ?? "Ошибка создания"); return; }

            const now = new Date().toISOString();
            const newTask: TaskView = {
                id: json.data.id,
                epicId: form.epicId,
                title: form.title.trim(),
                description: form.description.trim() || null,
                status: form.status,
                priority: form.priority,
                dueDate: form.dueDate ? `${form.dueDate}T00:00:00.000Z` : null,
                sortOrder: 9999,
                createdAt: now,
                updatedAt: now,
                assignees: [],
                subtasks: [],
                progress: { done: 0, total: 0 },
            };

            if (form.assigneeId) {
                await fetch(`/api/tasks/${newTask.id}/assignees`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: form.assigneeId }),
                });
                const assignee = users.find((u) => u.id === form.assigneeId);
                if (assignee) newTask.assignees = [assignee];
            }

            onCreated(newTask);
        } catch { setErr("Сетевая ошибка"); }
        finally { setLoading(false); }
    }

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 space-y-4"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--accent-500)" }}>

            {err && <p className="text-xs text-red-400 px-1">{err}</p>}

            <div>
                <label className="text-xs text-(--text-muted) block mb-1">Название *</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Название задачи"
                    className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-(--text-muted) outline-none focus:border-[var(--accent-500)] transition-colors" />
            </div>

            <div>
                <label className="text-xs text-(--text-muted) block mb-1">Описание</label>
                <textarea value={form.description} rows={2}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Описание задачи..."
                    className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-(--text-muted) outline-none focus:border-[var(--accent-500)] transition-colors resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-(--text-muted) block mb-1">Статус</label>
                    <div className="flex flex-wrap gap-1">
                        {STATUS_ORDER.map((s) => {
                            const meta = STATUS_META[s as TaskStatus];
                            const active = form.status === s;
                            return (
                                <button key={s} onClick={() => setForm((f) => ({ ...f, status: s as TaskStatus }))}
                                    className="px-2 py-0.5 rounded-full text-xs font-medium transition-all"
                                    style={active
                                        ? { background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }
                                        : { background: "var(--glass-01)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" }}>
                                    {meta.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <label className="text-xs text-(--text-muted) block mb-1">Приоритет</label>
                    <div className="flex flex-wrap gap-1">
                        {PRIORITY_ORDER.map((p) => {
                            const meta = PRIORITY_META[p as TaskPriority];
                            const active = form.priority === p;
                            return (
                                <button key={p} onClick={() => setForm((f) => ({ ...f, priority: p as TaskPriority }))}
                                    className="px-2 py-0.5 rounded-full text-xs font-medium transition-all"
                                    style={active
                                        ? { background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }
                                        : { background: "var(--glass-01)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" }}>
                                    {meta.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <label className="text-xs text-(--text-muted) block mb-1">Эпик *</label>
                    <select value={form.epicId} onChange={(e) => setForm((f) => ({ ...f, epicId: Number(e.target.value) }))}
                        className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-500)] transition-colors">
                        {epics.map((ep) => (
                            <option key={ep.id} value={ep.id}
                                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                                {ep.title}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs text-(--text-muted) block mb-1">Исполнитель</label>
                    <select value={form.assigneeId} onChange={(e) => setForm((f) => ({ ...f, assigneeId: Number(e.target.value) }))}
                        className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-500)] transition-colors">
                        <option value={0} style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>— Не назначен —</option>
                        {users.map((u) => (
                            <option key={u.id} value={u.id}
                                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                                {u.name} ({u.roleMeta.label})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-span-2">
                    <label className="text-xs text-(--text-muted) block mb-1">Дедлайн</label>
                    <input type="date" value={form.dueDate}
                        onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                        style={{ colorScheme: "dark" }}
                        className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-500)] transition-colors" />
                </div>
            </div>

            <div className="flex gap-2 pt-1">
                <button onClick={submit} disabled={loading}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                        background: "var(--accent-glow)", color: "var(--accent-400)",
                        border: "1px solid rgba(139,92,246,0.3)", opacity: loading ? 0.6 : 1
                    }}>
                    {loading ? "Создание..." : "Создать задачу"}
                </button>
                <button onClick={onCancel}
                    className="px-4 py-2 rounded-xl text-sm text-(--text-muted) transition-all"
                    style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}>
                    Отмена
                </button>
            </div>
        </motion.div>
    );
}

// ─── TasksTab ─────────────────────────────────────────────────────────────────

export function TasksTab({ initialEpics, users }: Props) {
    const [epics, setEpics] = useState<EpicWithTasks[]>(initialEpics);
    const [filterEpic, setFilterEpic] = useState<number | "all">("all");
    const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const allTasks = useMemo<(TaskView & { epicColor: string; epicTitle: string })[]>(
        () => epics.flatMap((e) => e.tasks.map((t) => ({ ...t, epicColor: e.color, epicTitle: e.title }))),
        [epics],
    );

    const filteredTasks = useMemo(() => allTasks.filter((t) => {
        if (filterEpic !== "all" && t.epicId !== filterEpic) return false;
        if (filterStatus !== "all" && t.status !== filterStatus) return false;
        return true;
    }), [allTasks, filterEpic, filterStatus]);

    const handleUpdate = useCallback(async (
        task: TaskView,
        patch: Partial<{ title: string; description: string | null; status: TaskStatus; priority: TaskPriority; dueDate: string | null; epicId: number }>
    ) => {
        const snapshot = epics;
        setEpics((prev) => prev.map((e) => {
            if (patch.epicId && patch.epicId !== task.epicId) {
                const updatedTask = { ...task, ...patch };
                if (e.id === task.epicId) {
                    return { ...e, tasks: e.tasks.filter((t) => t.id !== task.id), progress: { total: e.progress.total - 1, done: e.progress.done - (task.status === "done" ? 1 : 0) } };
                }
                if (e.id === patch.epicId) {
                    return { ...e, tasks: [...e.tasks, updatedTask], progress: { total: e.progress.total + 1, done: e.progress.done + (updatedTask.status === "done" ? 1 : 0) } };
                }
                return e;
            }
            return { ...e, tasks: e.tasks.map((t) => t.id === task.id ? { ...t, ...patch } : t) };
        }));

        try {
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            if (!res.ok) {
                setEpics(snapshot);
                const json = await res.json();
                setError(json.error ?? "Ошибка обновления");
            }
        } catch {
            setEpics(snapshot);
            setError("Сетевая ошибка");
        }
    }, [epics]);

    const handleDelete = useCallback(async (task: TaskView) => {
        const snapshot = epics;
        setEpics((prev) => prev.map((e) =>
            e.id !== task.epicId ? e : {
                ...e,
                tasks: e.tasks.filter((t) => t.id !== task.id),
                progress: { total: e.progress.total - 1, done: e.progress.done - (task.status === "done" ? 1 : 0) },
            }
        ));

        try {
            const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
            if (!res.ok) {
                setEpics(snapshot);
                const json = await res.json();
                setError(json.error ?? "Ошибка удаления");
            }
        } catch {
            setEpics(snapshot);
            setError("Сетевая ошибка");
        }
    }, [epics]);

    const statuses = STATUS_ORDER.map((s) => ({
        status: s,
        count: allTasks.filter((t) => t.status === s).length,
        ...STATUS_META[s as TaskStatus],
    }));

    return (
        <div className="max-w-3xl space-y-4">

            {/* Stats row */}
            <div className="flex items-center gap-1 flex-wrap">
                {statuses.map(({ status, count, label, color, bg, border }) => (
                    <button key={status}
                        onClick={() => setFilterStatus((v) => v === status ? "all" : status as TaskStatus)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                        style={filterStatus === status
                            ? { background: bg, color, borderColor: border }
                            : { background: "var(--glass-01)", color: "var(--text-secondary)", borderColor: "var(--glass-border)" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {label}
                        <span className="font-mono font-bold">{count}</span>
                    </button>
                ))}
                <span className="ml-auto text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    {filteredTasks.length} / {allTasks.length}
                </span>
            </div>

            {/* Epic filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button onClick={() => setFilterEpic("all")}
                    className="shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all"
                    style={filterEpic === "all"
                        ? { background: "var(--accent-glow)", color: "var(--accent-400)", borderColor: "rgba(139,92,246,0.3)" }
                        : { background: "var(--glass-01)", color: "var(--text-secondary)", borderColor: "var(--glass-border)" }}>
                    Все эпики
                </button>
                {epics.map((e) => (
                    <button key={e.id} onClick={() => setFilterEpic((v) => v === e.id ? "all" : e.id)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all"
                        style={filterEpic === e.id
                            ? { background: `${e.color}20`, color: e.color, borderColor: `${e.color}40` }
                            : { background: "var(--glass-01)", color: "var(--text-secondary)", borderColor: "var(--glass-border)" }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                        {e.title}
                    </button>
                ))}
            </div>

            {/* Error toast */}
            <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="px-4 py-3 rounded-xl text-sm flex items-center gap-3"
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                        {error}
                        <button onClick={() => setError(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tasks list */}
            <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                    {filteredTasks.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex flex-col items-center py-12 text-center">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3"
                                style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)" }}>
                                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                                    strokeWidth="1.5" style={{ color: "var(--text-muted)" }}>
                                    <circle cx="9" cy="9" r="6" /><path d="m15 15 4 4" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Задачи не найдены</p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Измените фильтры или создайте задачу</p>
                        </motion.div>
                    ) : (
                        filteredTasks.map((task) => (
                            <TaskCard key={task.id} task={task} epics={epics} users={users}
                                epicColor={task.epicColor}
                                onUpdate={(patch) => handleUpdate(task, patch)}
                                onDelete={() => handleDelete(task)} />
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Create button / form */}
            {!creating ? (
                <button onClick={() => setCreating(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full"
                    style={{ border: "1px dashed var(--glass-border)", color: "var(--text-muted)" }}>
                    <span className="text-lg leading-none">+</span>
                    Добавить задачу
                </button>
            ) : (
                <CreateTaskForm epics={epics} users={users}
                    defaultEpicId={filterEpic !== "all" ? filterEpic : null}
                    onCreated={(task) => {
                        setEpics((prev) => prev.map((e) =>
                            e.id !== task.epicId ? e : {
                                ...e,
                                tasks: [...e.tasks, task],
                                progress: { total: e.progress.total + 1, done: e.progress.done },
                            }
                        ));
                        setCreating(false);
                    }}
                    onCancel={() => setCreating(false)} />
            )}
        </div>
    );
}