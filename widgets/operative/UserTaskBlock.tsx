"use client";
/**
 * @file UserTaskBlock.tsx — widgets/operative
 *
 * v5 — DnD для администраторов:
 *   - При isAdmin: задачи можно перетаскивать для изменения порядка (@dnd-kit)
 *   - Оптимистичное обновление + синхронизация с сервером через updateOrderAction
 *   - При !isAdmin: только просмотр + изменение статуса задачи
 *
 * Ограничения прав (только для раздела "Оперативные задачи"):
 *   Администратор: полный CRUD, DnD, изменение дедлайна, подзадачи
 *   Гость: только переключение статуса задачи (готово/не готово)
 */
import { useState, useRef, useCallback, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOptimistic, useTransition } from "react";
import { useOperativeStore } from "@/shared/store/useOperativeStore";
import { useIsOffline } from "@/shared/lib/hooks/useIsOffline";
import { formatDate, formatDateInput } from "@/shared/lib/utils";
import { updateOrderAction } from "@/entities/operative/operativeActions";
import type {
  UserWithOperativeTasks,
  OperativeTaskView,
  OperativeSubtaskView,
  OperativeTaskStatus,
} from "@/entities/operative/operativeRepository";
import { useShallow } from "zustand/react/shallow";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<
  OperativeTaskStatus,
  { label: string; color: string; bg: string; dot: string; next: OperativeTaskStatus }
> = {
  todo:        { label: "К работе", color: "#94a3b8", bg: "rgba(100,116,139,0.14)", dot: "#64748b",  next: "in_progress" },
  in_progress: { label: "В работе", color: "#38bdf8", bg: "rgba(14,165,233,0.14)",  dot: "#38bdf8",  next: "done"        },
  done:        { label: "Готово",   color: "#34d399", bg: "rgba(16,185,129,0.14)",  dot: "#34d399",  next: "todo"        },
};

// ── Deadline helpers ──────────────────────────────────────────────────────────

interface DeadlineInfo {
  label: string;
  isOverdue: boolean;
  isSoon: boolean;
  isToday: boolean;
  daysLeft: number;
}

function deadlineInfo(dueDate: string | null | undefined): DeadlineInfo | null {
  if (!dueDate) return null;
  const due     = new Date(dueDate);
  const now     = new Date();
  const diffMs  = due.getTime() - now.getTime();
  const daysLeft   = diffMs / (1000 * 60 * 60 * 24);
  const isOverdue  = diffMs < 0;
  const isToday    = !isOverdue && Math.floor(daysLeft) === 0;
  const isSoon     = !isOverdue && daysLeft <= 3;
  return {
    label: formatDate(dueDate),
    isOverdue,
    isSoon,
    isToday,
    daysLeft: Math.max(0, Math.floor(daysLeft)),
  };
}

function getDeadlineStyle(info: DeadlineInfo | null, isDone: boolean) {
  if (!info || isDone) return null;
  if (info.isOverdue)
    return { color: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)", pulse: true, label: `${info.label} ⚠` };
  if (info.isToday)
    return { color: "#fb923c", bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.35)", pulse: true, label: "Сегодня" };
  if (info.isSoon)
    return { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.30)", pulse: false, label: info.daysLeft <= 1 ? "Завтра" : `${info.daysLeft} дн.` };
  return null;
}

// ── Status pill ───────────────────────────────────────────────────────────────

const StatusPill = memo(function StatusPill({
  status, onClick, disabled,
}: { status: OperativeTaskStatus; onClick: (e: React.MouseEvent) => void; disabled: boolean }) {
  const s = STATUS[status];
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold select-none shrink-0"
      style={{
        background: s.bg, color: s.color,
        border: `1px solid ${s.dot}28`,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
      title={disabled ? "Смена статуса недоступна" : `→ ${STATUS[s.next].label}`}
    >
      <motion.span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: s.dot }}
        animate={status === "in_progress" ? { scale: [1, 1.5, 1], opacity: [1, 0.4, 1] } : {}}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
      {s.label}
    </button>
  );
});

// ── Due date badge ────────────────────────────────────────────────────────────

function DueBadge({ dueDate, isDone }: { dueDate: string | null | undefined; isDone: boolean }) {
  const info = deadlineInfo(dueDate);
  const style = getDeadlineStyle(info, isDone);
  if (!info) return null;
  if (isDone) return <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>{info.label}</span>;
  if (!style) return <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded" style={{ color: "#64748b" }}>{info.label}</span>;
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded-md font-semibold"
      style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
    >
      {style.pulse
        ? <motion.span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: style.color }} animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
        : <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: style.color }} />}
      {style.label}
    </span>
  );
}

// ── Subtask row ───────────────────────────────────────────────────────────────

const SubtaskRow = memo(function SubtaskRow({
  subtask, accentColor, onToggle, canEdit,
}: { subtask: OperativeSubtaskView; accentColor: string; onToggle: () => void; canEdit: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2.5 py-1.5 group/st"
      onClick={canEdit ? onToggle : undefined}
      style={{ cursor: canEdit ? "pointer" : "default" }}
    >
      <div
        className="w-4 h-4 rounded-md shrink-0 flex items-center justify-center border transition-all duration-150"
        style={{
          background: subtask.isCompleted ? accentColor : "transparent",
          borderColor: subtask.isCompleted ? accentColor : "var(--glass-border-active)",
          boxShadow: subtask.isCompleted ? `0 0 6px ${accentColor}50` : "none",
        }}
      >
        <AnimatePresence>
          {subtask.isCompleted && (
            <motion.svg initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.12, ease: "backOut" }}
              className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" />
            </motion.svg>
          )}
        </AnimatePresence>
      </div>
      <span className="text-xs leading-snug flex-1 transition-colors"
        style={{ color: subtask.isCompleted ? "var(--text-muted)" : "var(--text-secondary)", textDecoration: subtask.isCompleted ? "line-through" : "none", opacity: subtask.isCompleted ? 0.6 : 1 }}>
        {subtask.title}
      </span>
    </motion.div>
  );
});

// ── Inline input ──────────────────────────────────────────────────────────────

function InlineInput({ placeholder, onSave, onCancel, accentColor }: {
  placeholder: string; onSave: (v: string) => void; onCancel: () => void; accentColor: string;
}) {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const submit = () => { const v = val.trim(); if (v) onSave(v); else onCancel(); };
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: "var(--glass-01)", border: `1px solid ${accentColor}45`, boxShadow: `0 0 0 3px ${accentColor}10` }}>
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
        onBlur={() => { if (!val.trim()) onCancel(); }}
        placeholder={placeholder} maxLength={200}
        className="flex-1 text-sm bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
      <button onMouseDown={e => { e.preventDefault(); onCancel(); }} style={{ color: "var(--text-muted)", lineHeight: 1 }}>
        <svg viewBox="0 0 10 10" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l6 6M8 2L2 8" /></svg>
      </button>
    </motion.div>
  );
}

// ── Sortable Task Card ────────────────────────────────────────────────────────

function SortableTaskCard({
  task, userId, accentColor, canEdit, isDragEnabled,
}: { task: OperativeTaskView; userId: number; accentColor: string; canEdit: boolean; isDragEnabled: boolean }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id, disabled: !isDragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCardInner
        task={task} userId={userId} accentColor={accentColor}
        canEdit={canEdit} dragHandleProps={isDragEnabled ? { ...attributes, ...listeners } : null}
      />
    </div>
  );
}

// ── Task Card (inner) ─────────────────────────────────────────────────────────

function TaskCardInner({
  task, userId, accentColor, canEdit, dragHandleProps,
}: {
  task: OperativeTaskView; userId: number; accentColor: string; canEdit: boolean;
  dragHandleProps: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [editingDate, setEditingDate] = useState(false);

  const liveTask      = useOperativeStore(s => s.getTask(task.id)) ?? task;
  const updateStatus  = useOperativeStore(s => s.updateStatus);
  const updateDueDate = useOperativeStore(s => s.updateDueDate);
  const addSubtask    = useOperativeStore(s => s.addSubtask);
  const toggleSubtask = useOperativeStore(s => s.toggleSubtask);

  const isDone = liveTask.status === "done";
  const dl = deadlineInfo(liveTask.dueDate);
  const dlStyle = getDeadlineStyle(dl, isDone);
  const s = STATUS[liveTask.status];
  const subDone = liveTask.progress.done;
  const subTotal = liveTask.progress.total;
  const subPct = subTotal > 0 ? (subDone / subTotal) * 100 : 0;

  const cycleStatus = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    updateStatus(liveTask.id, userId, STATUS[liveTask.status].next);
  }, [liveTask.id, liveTask.status, userId, updateStatus]);

  const markDone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    updateStatus(liveTask.id, userId, liveTask.status !== "done" ? "done" : "todo");
  }, [liveTask.id, liveTask.status, userId, updateStatus]);

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-xl overflow-hidden relative"
      style={{
        background: "var(--bg-overlay)",
        border: `1px solid ${dlStyle && !isDone ? dlStyle.border : "var(--glass-border)"}`,
        borderLeft: `2px solid ${dlStyle?.border && !isDone ? dlStyle.border.replace("0.4", "1") : isDone ? "#34d399" : s.dot}`,
        opacity: isDone ? 0.72 : 1,
      }}>

      {/* Main row */}
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2">
          {/* Drag handle — admin only */}
          {dragHandleProps && (
            <button
              {...dragHandleProps}
              className="shrink-0 w-5 h-5 flex items-center justify-center opacity-30 hover:opacity-70 cursor-grab active:cursor-grabbing"
              aria-label="Перетащить задачу"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M6 4h.01M6 8h.01M6 12h.01M10 4h.01M10 8h.01M10 12h.01" />
              </svg>
            </button>
          )}

          <StatusPill status={liveTask.status} onClick={cycleStatus} disabled={false} />
          <div className="flex-1 min-w-0" />
          <DueBadge dueDate={liveTask.dueDate} isDone={isDone} />

          <button onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <motion.svg viewBox="0 0 12 12" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
              animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <path d="M2 4.5l4 4 4-4" />
            </motion.svg>
          </button>
        </div>

        <div className="flex items-start gap-2">
          <p className="text-sm font-medium leading-snug flex-1"
            style={{ color: isDone ? "var(--text-muted)" : "var(--text-primary)", textDecoration: isDone ? "line-through" : "none" }}>
            {liveTask.title}
          </p>
          {/* Mark done button — available to everyone */}
          <motion.button onClick={markDone} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            title={isDone ? "Вернуть в работу" : "Выполнено"}
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
            style={{
              background: isDone ? "rgba(52,211,153,0.15)" : "var(--glass-01)",
              border: isDone ? "1.5px solid #34d399" : "1.5px solid var(--glass-border-active)",
              color: isDone ? "#34d399" : "var(--text-muted)",
            }}>
            <svg viewBox="0 0 10 10" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" />
            </svg>
          </motion.button>
        </div>

        {subTotal > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div className="h-full rounded-full" style={{ backgroundColor: s.dot }}
                animate={{ width: `${subPct}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
            </div>
            <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>{subDone}/{subTotal}</span>
          </div>
        )}
      </div>

      {/* Expanded panel — admin only features */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden", borderTop: "1px solid var(--glass-border)" }}>
            <div className="px-3 py-3 space-y-3" onClick={e => e.stopPropagation()}>

              {liveTask.description && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{liveTask.description}</p>
              )}

              {/* Due date — admin only */}
              {canEdit && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest font-semibold shrink-0" style={{ color: "var(--text-muted)" }}>Дедлайн</span>
                  {editingDate ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input autoFocus type="date" defaultValue={formatDateInput(liveTask.dueDate)}
                        onChange={e => { const v = e.target.value; updateDueDate(liveTask.id, userId, v ? `${v}T00:00:00.000Z` : null); }}
                        onBlur={() => setEditingDate(false)}
                        className="flex-1 px-2 py-1 rounded-lg text-xs outline-none"
                        style={{ background: "var(--glass-01)", border: "1px solid var(--accent-500)", color: "var(--text-primary)", colorScheme: "light dark" }} />
                      {liveTask.dueDate && (
                        <button onClick={() => { updateDueDate(liveTask.id, userId, null); setEditingDate(false); }} style={{ color: "#f87171" }}>✕</button>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => setEditingDate(true)}
                      className="text-xs px-2 py-0.5 rounded-lg"
                      style={{ color: liveTask.dueDate ? (dl?.isOverdue ? "#f87171" : dl?.isSoon ? "#fbbf24" : "var(--text-secondary)") : "var(--text-muted)", background: "var(--glass-01)", border: "1px solid var(--glass-border)", cursor: "pointer" }}>
                      {liveTask.dueDate ? `${formatDate(liveTask.dueDate)}${dl?.isOverdue ? " ⚠" : ""}` : "+ Установить дедлайн"}
                    </button>
                  )}
                </div>
              )}

              {canEdit && <div style={{ height: 1, background: "var(--glass-border)" }} />}

              {/* Subtasks */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>Подзадачи</span>
                  {subTotal > 0 && <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{subDone}/{subTotal}</span>}
                </div>
                <div className="space-y-0.5">
                  <AnimatePresence>
                    {liveTask.subtasks.map((st: OperativeSubtaskView) => (
                      <SubtaskRow key={st.id} subtask={st} accentColor={accentColor} canEdit={canEdit}
                        onToggle={() => toggleSubtask(liveTask.id, userId, st.id, st.isCompleted)} />
                    ))}
                  </AnimatePresence>
                  {liveTask.subtasks.length === 0 && !addingSub && (
                    <p className="text-xs py-1" style={{ color: "var(--text-muted)" }}>Нет подзадач</p>
                  )}
                </div>
                <AnimatePresence>
                  {addingSub && (
                    <div className="mt-2">
                      <InlineInput placeholder="Название подзадачи..." accentColor={accentColor}
                        onSave={async title => { setAddingSub(false); await addSubtask(liveTask.id, userId, title); }}
                        onCancel={() => setAddingSub(false)} />
                    </div>
                  )}
                </AnimatePresence>
                {!addingSub && canEdit && (
                  <button onClick={() => setAddingSub(true)}
                    className="mt-2 flex items-center gap-1.5 text-xs w-full px-1 py-1 rounded-lg transition-all"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = accentColor; (e.currentTarget as HTMLElement).style.background = `${accentColor}10`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
                    Добавить подзадачу
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Add task form ─────────────────────────────────────────────────────────────

function AddTaskForm({ userId, accentColor, onAdd, onCancel }: {
  userId: number; accentColor: string;
  onAdd: (title: string, dueDate: string | null) => Promise<void>; onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const submit = useCallback(async () => {
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    try { await onAdd(t, dueDate ? `${dueDate}T00:00:00.000Z` : null); }
    finally { setSaving(false); }
  }, [title, dueDate, saving, onAdd]);

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-overlay)", border: `1px solid ${accentColor}50`, boxShadow: `0 0 0 3px ${accentColor}10` }}>
      <div className="px-3 pt-2.5 pb-2 space-y-2">
        <input ref={ref} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
          placeholder="Название задачи..." maxLength={200} disabled={saving}
          className="w-full text-sm bg-transparent outline-none font-medium" style={{ color: "var(--text-primary)" }} />
        <AnimatePresence>
          {showDate && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
              <div className="flex items-center gap-2 pt-1">
                <input type="date" value={dueDate} onChange={e => setDate(e.target.value)}
                  className="flex-1 text-xs bg-transparent outline-none" style={{ color: dueDate ? "var(--text-secondary)" : "var(--text-muted)", colorScheme: "light dark" }} />
                {dueDate && <button onClick={() => setDate("")} style={{ color: "var(--text-muted)" }}>✕</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: "1px solid var(--glass-border)" }}>
        <button onClick={() => setShowDate(v => !v)}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg"
          style={{ color: showDate ? accentColor : "var(--text-muted)", background: showDate ? `${accentColor}12` : "transparent" }}>
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <rect x="1" y="2" width="10" height="9" rx="1.5" /><path d="M4 1v2M8 1v2M1 5h10" />
          </svg>
          {dueDate ? formatDate(`${dueDate}T00:00:00.000Z`) : "Дедлайн"}
        </button>
        <div className="flex-1" />
        <motion.button onClick={submit} disabled={!title.trim() || saving}
          whileHover={title.trim() && !saving ? { scale: 1.03 } : {}} whileTap={title.trim() && !saving ? { scale: 0.97 } : {}}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: title.trim() ? `${accentColor}22` : "var(--glass-01)", border: `1px solid ${title.trim() ? accentColor + "45" : "var(--glass-border)"}`, color: title.trim() ? accentColor : "var(--text-muted)", opacity: saving ? 0.6 : 1 }}>
          {saving ? "..." : "Добавить ↵"}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Sortable task list (admin) ────────────────────────────────────────────────

function SortableTaskList({ tasks, userId, accentColor, canEdit }: {
  tasks: OperativeTaskView[]; userId: number; accentColor: string; canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticTasks, setOptimisticTasks] = useOptimistic(
    tasks,
    (_state: OperativeTaskView[], newOrder: OperativeTaskView[]) => newOrder,
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = optimisticTasks.findIndex(t => t.id === active.id);
    const newIndex = optimisticTasks.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(optimisticTasks, oldIndex, newIndex);

    startTransition(async () => {
      setOptimisticTasks(reordered);
      await updateOrderAction({
        items: reordered.map((t, i) => ({ id: t.id, order: i })),
      });
    });
  }, [optimisticTasks, setOptimisticTasks]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={optimisticTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2" style={{ opacity: isPending ? 0.85 : 1, transition: "opacity 0.15s" }}>
          <AnimatePresence mode="popLayout">
            {optimisticTasks.map(task => (
              <SortableTaskCard key={task.id} task={task} userId={userId} accentColor={accentColor}
                canEdit={canEdit} isDragEnabled={canEdit} />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ── Sort tasks ────────────────────────────────────────────────────────────────

const STATUS_ORDER_MAP: Record<OperativeTaskStatus, number> = { in_progress: 0, todo: 1, done: 2 };

function sortTasks(tasks: OperativeTaskView[]): OperativeTaskView[] {
  return [...tasks].sort((a, b) => {
    const sd = STATUS_ORDER_MAP[a.status] - STATUS_ORDER_MAP[b.status];
    if (sd !== 0) return sd;
    const ao = !!(a.dueDate && new Date(a.dueDate) < new Date() && a.status !== "done");
    const bo = !!(b.dueDate && new Date(b.dueDate) < new Date() && b.status !== "done");
    if (ao && !bo) return -1;
    if (!ao && bo) return 1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return a.order - b.order;
  });
}

// ── Main: UserTaskBlock ───────────────────────────────────────────────────────

interface Props {
  block: UserWithOperativeTasks;
  /** true = administrating user (full CRUD + DnD); false = read-only + status toggle */
  isAdmin: boolean;
}

export function UserTaskBlock({ block, isAdmin }: Props) {
  const { user } = block;
  const offline = useIsOffline();
  const [adding, setAdding] = useState(false);

  // canEdit = admin AND online
  const canEdit = isAdmin && !offline;

  const tasks   = useOperativeStore(useShallow(s => s.getTasksForUser(user.id)));
  const addTask = useOperativeStore(s => s.addTask);

  const accentColor = user.roleMeta.hex;
  const sorted = sortTasks(tasks);

  const total  = tasks.length;
  const done   = tasks.filter(t => t.status === "done").length;
  const inProg = tasks.filter(t => t.status === "in_progress").length;
  const overdue = tasks.filter(t => { const dl = deadlineInfo(t.dueDate); return dl?.isOverdue && t.status !== "done"; }).length;
  const urgent  = tasks.filter(t => { const dl = deadlineInfo(t.dueDate); return dl?.isSoon && !dl.isOverdue && t.status !== "done"; }).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = useCallback(async (title: string, dueDate: string | null) => {
    setAdding(false);
    await addTask({ userId: user.id, title, dueDate });
  }, [user.id, addTask]);

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", borderTop: `3px solid ${accentColor}` }}>

      {/* ── Header ── */}
      <div className="px-4 py-3 flex items-start gap-3"
        style={{ background: `linear-gradient(135deg, ${accentColor}0c 0%, transparent 55%)`, borderBottom: "1px solid var(--glass-border)" }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 14px ${accentColor}45` }}>
          {user.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}28` }}>
              {user.roleMeta.short} · {user.roleMeta.label}
            </span>
          </div>
          {total > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
                  {inProg > 0 && <span style={{ color: "#38bdf8" }}>● {inProg} в работе</span>}
                  {overdue > 0 && <motion.span style={{ color: "#f87171" }} animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>⚠ {overdue} просроч.</motion.span>}
                  {urgent > 0 && overdue === 0 && <span style={{ color: "#fbbf24" }}>⏰ {urgent} срочно</span>}
                </div>
                <span className="text-[10px] font-mono" style={{ color: accentColor }}>{done}/{total}</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div className="h-full rounded-full" style={{ backgroundColor: accentColor }}
                  animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Task list ── */}
      <div className="flex-1 p-2.5" style={{ minHeight: 80 }}>
        {sorted.length === 0 && !adding ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-6 text-center">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
              style={{ background: `${accentColor}12`, border: `1px dashed ${accentColor}30` }}>
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
                <path d="M8 4v8M4 8h8" />
              </svg>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Нет задач</p>
            {canEdit && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.6 }}>Нажмите «+» чтобы добавить</p>}
          </motion.div>
        ) : isAdmin ? (
          /* Admin: sortable list with DnD */
          <SortableTaskList tasks={sorted} userId={user.id} accentColor={accentColor} canEdit={canEdit} />
        ) : (
          /* Guest: read-only list, but status toggle is allowed */
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {sorted.map(task => (
                <TaskCardInner key={task.id} task={task} userId={user.id} accentColor={accentColor}
                  canEdit={false} dragHandleProps={null} />
              ))}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {adding && (
            <AddTaskForm key="add" userId={user.id} accentColor={accentColor} onAdd={handleAdd} onCancel={() => setAdding(false)} />
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="px-2.5 pb-2.5">
        {!canEdit ? (
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ color: "var(--text-muted)", background: "var(--glass-01)", border: "1px solid var(--glass-border)", opacity: 0.6 }}>
            {offline ? (
              <><svg viewBox="0 0 14 14" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <rect x="2" y="6" width="10" height="7" rx="1.5" /><path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" />
              </svg>Только просмотр (офлайн)</>
            ) : !isAdmin ? (
              <><svg viewBox="0 0 14 14" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="7" cy="5" r="3" /><path d="M1 13a6 6 0 0 1 12 0" />
              </svg>Только просмотр</>
            ) : null}
          </div>
        ) : (
          <motion.button onClick={() => setAdding(true)} disabled={adding}
            whileHover={{ borderColor: `${accentColor}50`, color: accentColor, background: `${accentColor}08` }}
            whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium"
            style={{ border: "1px dashed var(--glass-border)", color: "var(--text-muted)", background: "transparent", opacity: adding ? 0 : 1 }}>
            <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
            Добавить задачу
          </motion.button>
        )}
      </div>
    </div>
  );
}