"use client";
/**
 * @file UserTaskBlock.tsx — widgets/operative
 *
 * ОБНОВЛЕНИЕ v2 — Дедлайн оперативных задач:
 *   - Дедлайн отображается на карточке задачи (красный если просрочен)
 *   - В раскрытом виде — date-picker для установки/очистки дедлайна
 *   - Форма добавления новой задачи содержит поле дедлайна
 *   - store.updateDueDate() — оптимистичное обновление + rollback
 *
 * Правила UX:
 *  - Удаление задач и подзадач ЗАПРЕЩЕНО.
 *  - Статус циклически переключается кликом: todo → in_progress → done → todo.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOperativeStore } from "@/shared/store/useOperativeStore";
import { useIsOffline } from "@/shared/lib/hooks/useIsOffline";
import { formatDate, formatDateInput } from "@/shared/lib/utils";
import type {
  UserWithOperativeTasks,
  OperativeTaskView,
  OperativeTaskStatus,
} from "@/entities/operative/operativeRepository";
import { useShallow } from "zustand/react/shallow";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<
  OperativeTaskStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  todo: {
    label: "К работе",
    color: "#94a3b8",
    bg: "rgba(100,116,139,0.14)",
    border: "rgba(100,116,139,0.28)",
    dot: "#64748b",
  },
  in_progress: {
    label: "В работе",
    color: "#38bdf8",
    bg: "rgba(14,165,233,0.14)",
    border: "rgba(14,165,233,0.28)",
    dot: "#38bdf8",
  },
  done: {
    label: "Готово",
    color: "#34d399",
    bg: "rgba(16,185,129,0.14)",
    border: "rgba(16,185,129,0.28)",
    dot: "#34d399",
  },
};

const STATUS_CYCLE: OperativeTaskStatus[] = ["todo", "in_progress", "done"];

// ── Deadline helpers ──────────────────────────────────────────────────────────

function getDeadlineState(dueDate: string | null | undefined): {
  isOverdue: boolean;
  isSoon: boolean;
  label: string | null;
} {
  if (!dueDate) return { isOverdue: false, isSoon: false, label: null };
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return {
    isOverdue: diffMs < 0,
    isSoon: diffMs >= 0 && diffDays <= 3,
    label: formatDate(dueDate),
  };
}

function DeadlineBadge({ dueDate }: { dueDate: string | null | undefined }) {
  const { isOverdue, isSoon, label } = getDeadlineState(dueDate);
  if (!label) return null;

  const color = isOverdue ? "#f87171" : isSoon ? "#fbbf24" : "var(--text-muted)";
  const bg    = isOverdue
    ? "rgba(239,68,68,0.10)"
    : isSoon
    ? "rgba(251,191,36,0.10)"
    : "transparent";

  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono shrink-0"
      style={{ color, background: bg, border: isOverdue || isSoon ? `1px solid ${color}30` : "none" }}
      title={isOverdue ? "Просрочено" : isSoon ? "Скоро дедлайн" : "Дедлайн"}
    >
      <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <rect x="1" y="2" width="10" height="9" rx="1.5" />
        <path d="M4 1v2M8 1v2M1 5h10" />
      </svg>
      {label}
      {isOverdue && " ⚠"}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  onClick,
  disabled,
}: {
  status: OperativeTaskStatus;
  onClick: (e: React.MouseEvent) => void;
  disabled: boolean;
}) {
  const cfg = STATUS_CFG[status];
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      whileTap={disabled ? {} : { scale: 0.9 }}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 select-none transition-all"
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
      title={disabled ? "Недоступно офлайн" : `Сменить статус (${cfg.label})`}
    >
      <motion.span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: cfg.dot }}
        animate={
          status === "in_progress"
            ? { scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }
            : {}
        }
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      {cfg.label}
    </motion.button>
  );
}

// ── Inline date picker ────────────────────────────────────────────────────────

function InlineDatePicker({
  dueDate,
  onUpdate,
  disabled,
  accentColor,
}: {
  dueDate: string | null | undefined;
  onUpdate: (val: string | null) => void;
  disabled: boolean;
  accentColor: string;
}) {
  const { isOverdue, isSoon } = getDeadlineState(dueDate);
  const borderColor = isOverdue ? "#f87171" : isSoon ? "#fbbf24" : "var(--glass-border)";

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>
        Дедлайн
      </p>
      <div className="flex items-center gap-2">
        <input
          type="date"
          disabled={disabled}
          value={formatDateInput(dueDate)}
          onChange={(e) => {
            const val = e.target.value;
            onUpdate(val ? `${val}T00:00:00.000Z` : null);
          }}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none transition-all"
          style={{
            background: "var(--glass-01)",
            border: `1px solid ${dueDate ? borderColor : "var(--glass-border)"}`,
            color: dueDate ? (isOverdue ? "#f87171" : isSoon ? "#fbbf24" : "var(--text-primary)") : "var(--text-muted)",
            colorScheme: "light dark",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        />
        {dueDate && !disabled && (
          <motion.button
            onClick={() => onUpdate(null)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0"
            style={{ color: "var(--text-muted)", background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}
            title="Снять дедлайн"
          >
            <svg className="w-3 h-3" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2 2l6 6M8 2L2 8" />
            </svg>
          </motion.button>
        )}
      </div>
      {dueDate && (
        <p className="text-[10px] font-mono" style={{ color: isOverdue ? "#f87171" : isSoon ? "#fbbf24" : "var(--text-muted)" }}>
          {isOverdue ? "⚠ Просрочено" : isSoon ? "⏰ Скоро дедлайн" : formatDate(dueDate)}
        </p>
      )}
    </div>
  );
}

// ── Inline add input ──────────────────────────────────────────────────────────

function InlineAddInput({
  placeholder,
  onAdd,
  onCancel,
  accentColor,
}: {
  placeholder: string;
  onAdd: (title: string) => void;
  onCancel: () => void;
  accentColor: string;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = useCallback(() => {
    const v = value.trim();
    if (v) onAdd(v);
    else onCancel();
  }, [value, onAdd, onCancel]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-2 px-2 py-1.5 rounded-xl"
      style={{
        background: "var(--glass-01)",
        border: `1px solid ${accentColor}40`,
        boxShadow: `0 0 0 2px ${accentColor}10`,
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onBlur={() => { if (!value.trim()) onCancel(); }}
        placeholder={placeholder}
        maxLength={200}
        className="flex-1 text-sm bg-transparent outline-none"
        style={{ color: "var(--text-primary)" }}
      />
      <div className="flex items-center gap-1 shrink-0">
        <kbd
          className="px-1 py-0.5 rounded text-[9px] font-mono"
          style={{
            background: "var(--glass-02)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-muted)",
          }}
        >
          ↵
        </kbd>
        <button
          onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l8 8M10 2L2 10" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

// ── Subtask row ───────────────────────────────────────────────────────────────

function SubtaskRow({
  subtask,
  accentColor,
  onToggle,
  disabled,
}: {
  subtask: { id: number; title: string; isCompleted: boolean };
  accentColor: string;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2.5 py-1.5 group/st"
      onClick={disabled ? undefined : onToggle}
      style={{ cursor: disabled ? "default" : "pointer" }}
    >
      <motion.div
        whileTap={disabled ? {} : { scale: 0.85 }}
        className="mt-px w-4 h-4 rounded-md shrink-0 flex items-center justify-center border transition-all duration-150"
        style={{
          background: subtask.isCompleted ? accentColor : "transparent",
          borderColor: subtask.isCompleted ? accentColor : "var(--glass-border-active)",
          boxShadow: subtask.isCompleted ? `0 0 8px ${accentColor}50` : "none",
        }}
      >
        <AnimatePresence>
          {subtask.isCompleted && (
            <motion.svg
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.12, ease: "backOut" }}
              className="w-2.5 h-2.5 text-white"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1.5 5l2.5 2.5 4.5-4.5" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.div>
      <span
        className="text-xs leading-snug flex-1 transition-all"
        style={{
          color: subtask.isCompleted ? "var(--text-muted)" : "var(--text-secondary)",
          textDecoration: subtask.isCompleted ? "line-through" : "none",
          opacity: subtask.isCompleted ? 0.65 : 1,
        }}
      >
        {subtask.title}
      </span>
    </motion.div>
  );
}

// ── Operative Task Card ───────────────────────────────────────────────────────

function OperativeTaskCard({
  task,
  userId,
  accentColor,
  offline,
}: {
  task: OperativeTaskView;
  userId: number;
  accentColor: string;
  offline: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);

  const liveTask = useOperativeStore((s) => s.getTask(task.id)) ?? task;
  const updateStatus   = useOperativeStore((s) => s.updateStatus);
  const updateDueDate  = useOperativeStore((s) => s.updateDueDate);
  const addSubtask     = useOperativeStore((s) => s.addSubtask);
  const toggleSubtask  = useOperativeStore((s) => s.toggleSubtask);

  const cycleStatus = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = STATUS_CYCLE.indexOf(liveTask.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    updateStatus(liveTask.id, userId, next);
  }, [liveTask.id, liveTask.status, userId, updateStatus]);

  const handleAddSubtask = useCallback(async (title: string) => {
    setAddingSubtask(false);
    await addSubtask(liveTask.id, userId, title);
  }, [liveTask.id, userId, addSubtask]);

  const handleDueDateChange = useCallback((dueDate: string | null) => {
    updateDueDate(liveTask.id, userId, dueDate);
  }, [liveTask.id, userId, updateDueDate]);

  const isDone = liveTask.status === "done";
  const statusCfg = STATUS_CFG[liveTask.status];
  const totalSubs = liveTask.subtasks.length;
  const doneSubs = liveTask.progress.done;
  const progressPct = totalSubs > 0 ? (doneSubs / totalSubs) * 100 : 0;
  const { isOverdue } = getDeadlineState(liveTask.dueDate);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-overlay)",
        border: `1px solid ${isDone ? statusCfg.border : isOverdue ? "rgba(239,68,68,0.25)" : "var(--glass-border)"}`,
        borderLeft: `2px solid ${isOverdue && !isDone ? "#f87171" : statusCfg.dot}`,
      }}
    >
      <div className="px-3 py-2.5 space-y-2">
        {/* Row 1: Status + expand toggle */}
        <div className="flex items-center gap-2">
          <StatusBadge
            status={liveTask.status}
            onClick={cycleStatus}
            disabled={offline}
          />

          <div className="flex-1 min-w-0" />

          {/* Deadline badge — compact display */}
          <DeadlineBadge dueDate={liveTask.dueDate} />

          {/* Expand toggle */}
          <motion.button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--text-muted)" }}
            whileHover={{ background: "var(--glass-02)" }}
            whileTap={{ scale: 0.9 }}
            title={expanded ? "Свернуть" : "Развернуть"}
          >
            <motion.svg
              className="w-3.5 h-3.5"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path d="M2.5 5l4.5 4 4.5-4" />
            </motion.svg>
          </motion.button>
        </div>

        {/* Row 2: Title */}
        <p
          className="text-sm font-medium leading-snug"
          style={{
            color: isDone ? "var(--text-muted)" : "var(--text-primary)",
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {liveTask.title}
        </p>

        {/* Description */}
        {liveTask.description && (
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {liveTask.description}
          </p>
        )}

        {/* Subtask progress bar */}
        {totalSubs > 0 && (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: statusCfg.dot }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
              {doneSubs}/{totalSubs}
            </span>
          </div>
        )}
      </div>

      {/* Expanded panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden", borderTop: "1px solid var(--glass-border)" }}
          >
            <div className="px-3 py-3 space-y-3">
              {/* Deadline picker */}
              <InlineDatePicker
                dueDate={liveTask.dueDate}
                onUpdate={handleDueDateChange}
                disabled={offline}
                accentColor={accentColor}
              />

              {/* Divider */}
              <div style={{ height: 1, background: "var(--glass-border)" }} />

              {/* Subtask list header */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>
                  Подзадачи
                </span>
                {totalSubs > 0 && (
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                    {doneSubs}/{totalSubs}
                  </span>
                )}
              </div>

              {/* Subtask list */}
              <div className="space-y-0.5">
                <AnimatePresence>
                  {liveTask.subtasks.map((st) => (
                    <SubtaskRow
                      key={st.id}
                      subtask={st}
                      accentColor={accentColor}
                      disabled={offline}
                      onToggle={() => toggleSubtask(liveTask.id, userId, st.id, st.isCompleted)}
                    />
                  ))}
                </AnimatePresence>

                {liveTask.subtasks.length === 0 && !addingSubtask && (
                  <p className="text-xs py-1" style={{ color: "var(--text-muted)" }}>
                    Нет подзадач
                  </p>
                )}
              </div>

              {/* Add subtask input */}
              <AnimatePresence>
                {addingSubtask && (
                  <InlineAddInput
                    key="add-subtask"
                    placeholder="Название подзадачи..."
                    accentColor={accentColor}
                    onAdd={handleAddSubtask}
                    onCancel={() => setAddingSubtask(false)}
                  />
                )}
              </AnimatePresence>

              {!addingSubtask && !offline && (
                <button
                  onClick={() => setAddingSubtask(true)}
                  className="flex items-center gap-1.5 text-xs w-full px-1 py-1 rounded-lg transition-all"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = accentColor;
                    (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}10`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M6 1v10M1 6h10" />
                  </svg>
                  Подзадача
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Add Task Form ─────────────────────────────────────────────────────────────

function AddTaskForm({
  userId,
  accentColor,
  onAdd,
  onCancel,
}: {
  userId: number;
  accentColor: string;
  onAdd: (title: string, dueDate: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle]     = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onAdd(trimmed, dueDate ? `${dueDate}T00:00:00.000Z` : null);
    } finally {
      setSaving(false);
    }
  }, [title, dueDate, saving, onAdd]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--glass-01)",
        border: `1px solid ${accentColor}40`,
        boxShadow: `0 0 0 2px ${accentColor}10`,
      }}
    >
      <div className="px-3 py-2.5 space-y-2">
        {/* Title input */}
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          }}
          placeholder="Название задачи..."
          maxLength={200}
          disabled={saving}
          className="w-full text-sm bg-transparent outline-none font-medium"
          style={{ color: "var(--text-primary)" }}
        />

        {/* Due date input */}
        <div className="flex items-center gap-2">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ color: "var(--text-muted)" }}>
            <rect x="1" y="2" width="10" height="9" rx="1.5" />
            <path d="M4 1v2M8 1v2M1 5h10" />
          </svg>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={saving}
            className="flex-1 text-xs bg-transparent outline-none"
            style={{ color: dueDate ? "var(--text-secondary)" : "var(--text-muted)", colorScheme: "light dark" }}
          />
          {dueDate && (
            <button onClick={() => setDueDate("")} style={{ color: "var(--text-muted)" }}>
              <svg className="w-3 h-3" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 2l6 6M8 2L2 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderTop: "1px solid var(--glass-border)" }}
      >
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)" }}>↵</kbd>
          <span>сохранить</span>
          <span className="opacity-30 mx-1">·</span>
          <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)" }}>Esc</kbd>
          <span>отмена</span>
        </div>
        <div className="flex gap-1.5">
          <motion.button
            onClick={onCancel}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            className="px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
          >
            Отмена
          </motion.button>
          <motion.button
            onClick={submit}
            disabled={!title.trim() || saving}
            whileHover={title.trim() && !saving ? { scale: 1.04 } : {}}
            whileTap={title.trim() && !saving ? { scale: 0.96 } : {}}
            className="px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{
              background: title.trim() ? `${accentColor}22` : "var(--glass-01)",
              border: `1px solid ${title.trim() ? accentColor + "44" : "var(--glass-border)"}`,
              color: title.trim() ? accentColor : "var(--text-muted)",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "..." : "Добавить"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main: UserTaskBlock ───────────────────────────────────────────────────────

interface Props {
  block: UserWithOperativeTasks;
}

export function UserTaskBlock({ block }: Props) {
  const { user } = block;
  const offline = useIsOffline();
  const [adding, setAdding] = useState(false);

  const tasks    = useOperativeStore(useShallow((s) => s.getTasksForUser(user.id)));
  const addTask  = useOperativeStore((s) => s.addTask);

  const accentColor  = user.roleMeta.hex;
  const todoCount    = tasks.filter((t) => t.status === "todo").length;
  const inProgCount  = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount    = tasks.filter((t) => t.status === "done").length;
  const overdueCount = tasks.filter((t) => {
    const { isOverdue } = getDeadlineState(t.dueDate);
    return isOverdue && t.status !== "done";
  }).length;

  const handleAddTask = useCallback(async (title: string, dueDate: string | null) => {
    setAdding(false);
    await addTask({ userId: user.id, title, dueDate });
  }, [user.id, addTask]);

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderTop: `3px solid ${accentColor}`,
        minHeight: 280,
        boxShadow: `0 0 32px ${accentColor}08`,
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{
          background: `linear-gradient(135deg, ${accentColor}0d 0%, transparent 55%)`,
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 0 16px ${accentColor}50`,
          }}
        >
          {user.initials}
        </div>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {user.name}
          </p>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: `${accentColor}18`,
              color: accentColor,
              border: `1px solid ${accentColor}30`,
            }}
          >
            {user.roleMeta.short} · {user.roleMeta.label}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {overdueCount > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
              title={`${overdueCount} просроченных`}
            >
              ⚠{overdueCount}
            </span>
          )}
          {inProgCount > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(14,165,233,0.12)", color: "#38bdf8", border: "1px solid rgba(14,165,233,0.25)" }}
            >
              {inProgCount}
            </span>
          )}
          {todoCount > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--glass-02)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" }}
            >
              {todoCount}
            </span>
          )}
          {doneCount > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}
            >
              ✓{doneCount}
            </span>
          )}
        </div>
      </div>

      {/* ── Task list ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: 520 }}>
        <AnimatePresence mode="popLayout">
          {tasks.length === 0 && !adding && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8 text-center"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                style={{ background: `${accentColor}12`, border: `1px dashed ${accentColor}30` }}
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
                  <path d="M10 4v12M4 10h12" />
                </svg>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Нет задач
              </p>
            </motion.div>
          )}

          {tasks.map((task) => (
            <OperativeTaskCard
              key={task.id}
              task={task}
              userId={user.id}
              accentColor={accentColor}
              offline={offline}
            />
          ))}
        </AnimatePresence>

        {/* Add task form */}
        <AnimatePresence>
          {adding && (
            <AddTaskForm
              key="add-task"
              userId={user.id}
              accentColor={accentColor}
              onAdd={handleAddTask}
              onCancel={() => setAdding(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer: add button ──────────────────────────────── */}
      <div
        className="px-3 py-2.5"
        style={{ borderTop: "1px solid var(--glass-border)" }}
      >
        {offline ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
            style={{ color: "var(--text-muted)", opacity: 0.6 }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <rect x="2" y="6" width="10" height="7" rx="1.5" />
              <path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" />
            </svg>
            Только просмотр
          </div>
        ) : (
          <motion.button
            onClick={() => setAdding(true)}
            disabled={adding}
            whileHover={{ background: `${accentColor}12`, borderColor: `${accentColor}40` }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{
              border: "1px dashed var(--glass-border)",
              color: "var(--text-muted)",
              opacity: adding ? 0 : 1,
            }}
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 1v10M1 6h10" />
            </svg>
            Добавить задачу
          </motion.button>
        )}
      </div>
    </div>
  );
}