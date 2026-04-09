"use client";
/**
 * @file UserTaskBlock.tsx — widgets/operative
 *
 * Блок оперативных задач для одного пользователя.
 * Правила UX:
 *  - Удаление задач и подзадач ЗАПРЕЩЕНО.
 *  - Статус циклически переключается кликом: todo → in_progress → done → todo.
 *  - Задачи добавляются через inline-форму.
 *  - Подзадачи добавляются внутри раскрытой задачи.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOperativeStore } from "@/shared/store/useOperativeStore";
import { useIsOffline } from "@/shared/lib/hooks/useIsOffline";
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
  const updateStatus = useOperativeStore((s) => s.updateStatus);
  const addSubtask = useOperativeStore((s) => s.addSubtask);
  const toggleSubtask = useOperativeStore((s) => s.toggleSubtask);

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

  const isDone = liveTask.status === "done";
  const statusCfg = STATUS_CFG[liveTask.status];
  const totalSubs = liveTask.subtasks.length;
  const doneSubs = liveTask.progress.done;
  const progressPct = totalSubs > 0 ? (doneSubs / totalSubs) * 100 : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-overlay)",
        border: `1px solid ${isDone ? statusCfg.border : "var(--glass-border)"}`,
        borderLeft: `2px solid ${statusCfg.dot}`,
      }}
    >
      <div className="px-3 py-2.5 space-y-2">
        {/* Status + title row */}
        <div className="flex items-start gap-2">
          <StatusBadge
            status={liveTask.status}
            onClick={cycleStatus}
            disabled={offline}
          />
          <p
            className="flex-1 text-sm font-medium leading-snug pt-0.5"
            style={{
              color: isDone ? "var(--text-muted)" : "var(--text-primary)",
              textDecoration: isDone ? "line-through" : "none",
            }}
          >
            {liveTask.title}
          </p>

          {/* Expand toggle — only if there are subtasks or we can add */}
          <motion.button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--text-muted)" }}
            whileHover={{ background: "var(--glass-02)" }}
            whileTap={{ scale: 0.9 }}
            title={expanded ? "Свернуть" : "Развернуть подзадачи"}
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

      {/* Expanded subtask panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden", borderTop: "1px solid var(--glass-border)" }}
          >
            <div className="px-3 py-2.5 space-y-1">
              {/* Subtask list */}
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

              {/* Empty state */}
              {liveTask.subtasks.length === 0 && !addingSubtask && (
                <p className="text-xs py-1" style={{ color: "var(--text-muted)" }}>
                  Нет подзадач
                </p>
              )}

              {/* Add subtask */}
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
                  className="flex items-center gap-1.5 text-xs w-full mt-1 px-1 py-1 rounded-lg transition-colors"
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

// ── Main: UserTaskBlock ───────────────────────────────────────────────────────

interface Props {
  block: UserWithOperativeTasks;
}

export function UserTaskBlock({ block }: Props) {
  const { user } = block;
  const offline = useIsOffline();
  const [adding, setAdding] = useState(false);

  const tasks = useOperativeStore(
    useShallow((s) => s.getTasksForUser(user.id))
  ); 
  const addTask = useOperativeStore((s) => s.addTask);

  const accentColor = user.roleMeta.hex;
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgCount = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  const handleAddTask = useCallback(async (title: string) => {
    setAdding(false);
    await addTask({ userId: user.id, title });
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
        <div className="flex items-center gap-1.5 shrink-0">
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
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: 480 }}>
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

        {/* Add task inline */}
        <AnimatePresence>
          {adding && (
            <InlineAddInput
              key="add-task"
              placeholder="Название задачи..."
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