"use client";
/**
 * @file TasksTab.tsx — app/(main)/settings
 *
 * ШАГ 3 — Offline-first для /settings:
 *
 *   БЫЛО: все мутации (updateTask, deleteTask) вызывали fetch() напрямую.
 *         При офлайн — fetch падал, изменение терялось, не попадало в pending_ops.
 *
 *   СТАЛО: мутации статуса, приоритета, заголовка, описания, дедлайна,
 *          удаление задачи — через useTaskStore:
 *            store.updateTaskStatus()      — статус
 *            store.updateTaskPriority()    — приоритет
 *            store.updateTaskTitle()       — заголовок
 *            store.updateTaskDescription() — описание
 *            store.updateTaskDueDate()     — дедлайн
 *            store.deleteTask()            — удаление
 *
 *   Эти методы уже реализуют offline-queue + rollback + синхронизацию.
 *   Переход epicId (перемещение в другой эпик) по-прежнему через fetch,
 *   т.к. требует сложной логики перемещения между эпиками, которую store
 *   пока не инкапсулирует — это приемлемо для редкой операции.
 *
 *   AssigneeManager уже использует store.addAssignee/removeAssignee — не трогаем.
 *
 * Остальные рефакторинги v2 сохранены без изменений.
 */
import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatDateInput, formatDateDisplay } from "@/shared/lib/utils";
import { STATUS_META, PRIORITY_META, STATUS_ORDER, PRIORITY_ORDER } from "@/shared/config/task-meta";
import { AssigneeManager } from "@/shared/ui/AssigneeManager";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useRouter } from "next/navigation";
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
    onEpicChange, onDelete,
}: {
    task: TaskView;
    epics: EpicWithTasks[];
    users: UserWithMeta[];
    epicColor: string;
    /** Epic change is NOT store-backed (rare operation, requires server) */
    onEpicChange: (epicId: number) => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [editingDesc, setEditingDesc] = useState(false);
    const [titleDraft, setTitleDraft] = useState(task.title);
    const [descDraft, setDescDraft] = useState(task.description ?? "");
    const [cycleStatus, setCycleStatus] = useState(false);
    const [cyclePriority, setCyclePriority] = useState(false);

    // ── Store actions (offline-safe) ──────────────────────────────────────────
    const updateTaskStatus      = useTaskStore((s) => s.updateTaskStatus);
    const updateTaskPriority    = useTaskStore((s) => s.updateTaskPriority);
    const updateTaskTitle       = useTaskStore((s) => s.updateTaskTitle);
    const updateTaskDescription = useTaskStore((s) => s.updateTaskDescription);
    const updateTaskDueDate     = useTaskStore((s) => s.updateTaskDueDate);

    const saveTitle = () => {
        setEditingTitle(false);
        if (titleDraft.trim() && titleDraft.trim() !== task.title) {
            updateTaskTitle(task.id, titleDraft.trim());
        } else {
            setTitleDraft(task.title);
        }
    };

    const saveDesc = () => {
        setEditingDesc(false);
        const v = descDraft.trim() || null;
        if (v !== task.description) {
            updateTaskDescription(task.id, v);
        }
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
                                                onClick={() => {
                                                    // ✅ OFFLINE-SAFE: через store
                                                    updateTaskStatus(task.id, s as TaskStatus);
                                                    setCycleStatus(false);
                                                }}
                                                className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-(--glass-01) transition-colors",
                                                    task.status === s && "bg-(--glass-02)")}>
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
                                                onClick={() => {
                                                    // ✅ OFFLINE-SAFE: через store
                                                    updateTaskPriority(task.id, p as TaskPriority);
                                                    setCyclePriority(false);
                                                }}
                                                className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-(--glass-01)sition-colors",
                                                    task.priority === p && "bg-(--glass-02)")}>
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
                        className="w-full bg-(--glass-01)er border-(--accent-500)ded-lg px-2 py-0.5 text-sm font-medium outline-none"
                        style={{ color: "var(--text-primary)" }} />
                ) : (
                    <button onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
                        className="group/t w-full text-left flex items-start gap-1">
                        <span className={cn("text-sm font-medium leading-snug",
                            task.status === "done" ? "line-through text-(--text-muted)" : "text-(--text-primary)")}>
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
                                        className="w-full bg-(--glass-01)er border-(--accent-500) rounded-lg px-2 py-1.5 text-sm outline-none resize-none"
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

                                {/* Due date — ✅ OFFLINE-SAFE через store */}
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                                        Дедлайн
                                    </p>
                                    <input type="date" value={formatDateInput(task.dueDate)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            updateTaskDueDate(task.id, val ? `${val}T00:00:00.000Z` : null);
                                        }}
                                        style={{ colorScheme: "dark", color: "var(--text-primary)" }}
                                        className="w-full bg-(--glass-01) border border-(--glass-border) rounded-lg px-2 py-1 text-xs outline-none focus:border-(--accent-500) transition-colors"
                                    />
                                    {task.dueDate && (
                                        <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                                            {formatDateDisplay(task.dueDate)}
                                        </p>
                                    )}
                                </div>

                                {/* Epic selector — прямой fetch (редкая операция перемещения) */}
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                                        Эпик
                                    </p>
                                    <select value={task.epicId}
                                        onChange={(e) => onEpicChange(Number(e.target.value))}
                                        className="w-full bg-(--glass-01) border border-(--glass-border) rounded-lg px-2 py-1 text-xs outline-none focus:border-(--accent-500) transition-colors"
                                        style={{ color: "var(--text-primary)" }}>
                                        {epics.map((ep) => (
                                            <option key={ep.id} value={ep.id}
                                                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                                                {ep.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Assignees — store.addAssignee/removeAssignee (offline-safe) */}
                                <div className="col-span-2">
                                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                                        Исполнители ({task.assignees.length})
                                    </p>
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
                                                    st.isCompleted ? "bg-(--accent-500) border-(--accent-500)" : "border-(--glass-border)")}>
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

    // ✅ Используем store.createTask — offline-safe
    const createTask = useTaskStore((s) => s.createTask);
    const updateTaskDueDate = useTaskStore((s) => s.updateTaskDueDate);
    const updateTaskDescription = useTaskStore((s) => s.updateTaskDescription);
    const addAssignee = useTaskStore((s) => s.addAssignee);

    async function submit() {
        if (!form.title.trim()) { setErr("Введите название"); return; }
        if (!form.epicId) { setErr("Выберите эпик"); return; }
        setLoading(true); setErr(null);
        try {
            const task = await createTask({
                epicId: form.epicId,
                title: form.title.trim(),
                status: form.status,
                priority: form.priority,
            });

            if (!task) { setErr("Ошибка создания"); return; }

            // Offline-safe: доп. поля кладём в очередь через store-мутации.
            if (form.dueDate) {
                await updateTaskDueDate(task.id, `${form.dueDate}T00:00:00.000Z`);
            }
            if (form.description.trim()) {
                await updateTaskDescription(task.id, form.description.trim());
            }
            if (form.assigneeId) {
                const assignee = users.find((u) => u.id === form.assigneeId);
                if (assignee) await addAssignee(task.id, assignee);
            }

            // Забираем актуальную версию task из store, чтобы onCreated получил
            // dueDate/description/assignees даже при optimistic updates.
            const updated = useTaskStore.getState().getTask(task.id) ?? task;
            onCreated(updated);
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
                    className="w-full bg-(--glass-01) border border-(--glass-border) rounded-lg px-3 py-1.5 text-sm text-(--text-primary) placeholder:text-(--text-muted) outline-none focus:border-(--accent-500) transition-colors" />
            </div>

            <div>
                <label className="text-xs text-(--text-muted) block mb-1">Описание</label>
                <textarea value={form.description} rows={2}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Описание задачи..."
                    className="w-full bg-(--glass-01) border border-(--glass-border) rounded-lg px-3 py-1.5 text-sm text-(--text-primary) placeholder:text-(--text-muted) outline-none focus:border-(--accent-500) transition-colors resize-none" />
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
                        className="w-full bg-(--glass-01) border border-(--glass-border)ded-lg px-3 py-1.5 text-sm text-(--text-primary) outline-none focus:border-(--accent-500) transition-colors">
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
                        className="w-full bg-(--glass-01) border border-(--glass-border) rounded-lg px-3 py-1.5 text-sm text-(--text-primary) outline-none focus:border-(--accent-500) transition-colors">
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
                        className="w-full bg-(--glass-01) border border-(--glass-border) rounded-lg px-3 py-1.5 text-sm text-(--text-primary) outline-none focus:border-(--accent-500) transition-colors" />
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
    const router = useRouter();
    const storeEpics = useTaskStore((s) => s.epics);
    // Пока store гидратится, рисуем серверный снапшот, чтобы UI не пустел.
    const epicsForUI = storeEpics.length > 0 ? storeEpics : initialEpics;
    const [filterEpic, setFilterEpic] = useState<number | "all">("all");
    const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ✅ Store actions для offline-safe мутаций
    const storeDeleteTask = useTaskStore((s) => s.deleteTask);

    const allTasks = useMemo<(TaskView & { epicColor: string; epicTitle: string })[]>(
        () => epicsForUI.flatMap((e) => e.tasks.map((t) => ({ ...t, epicColor: e.color, epicTitle: e.title }))),
        [epicsForUI],
    );

    const filteredTasks = useMemo(() => allTasks.filter((t) => {
        if (filterEpic !== "all" && t.epicId !== filterEpic) return false;
        if (filterStatus !== "all" && t.status !== filterStatus) return false;
        return true;
    }), [allTasks, filterEpic, filterStatus]);

    // ── Epic change (перемещение задачи в другой эпик) — прямой fetch ─────────
    // Это редкая сложная операция — она требует перемещения между эпиками
    // с обновлением прогресса, поэтому остаётся через fetch с локальным rollback
    const handleEpicChange = useCallback(async (
        task: TaskView,
        newEpicId: number,
    ) => {
        if (newEpicId === task.epicId) return;
        try {
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ epicId: newEpicId }),
            });
            if (!res.ok) {
                const json = await res.json();
                setError(json.error ?? "Ошибка обновления");
                return;
            }
            // После успеха перезагружаем страницу, чтобы store обновился из сервера.
            router.refresh();
        } catch {
            setError("Сетевая ошибка");
        }
    }, [router]);

    // ── Delete — через store (offline-safe) ──────────────────────────────────
    const handleDelete = useCallback(async (task: TaskView) => {
        // ✅ OFFLINE-SAFE: через store
        await storeDeleteTask(task.id);
    }, [storeDeleteTask]);

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
                {epicsForUI.map((e) => (
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
                            <TaskCard key={task.id} task={task} epics={epicsForUI} users={users}
                                epicColor={task.epicColor}
                                onEpicChange={(newEpicId) => handleEpicChange(task, newEpicId)}
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
                <CreateTaskForm epics={epicsForUI} users={users}
                    defaultEpicId={filterEpic !== "all" ? filterEpic : null}
                    onCreated={() => {
                        setCreating(false);
                    }}
                    onCancel={() => setCreating(false)} />
            )}
        </div>
    );
}