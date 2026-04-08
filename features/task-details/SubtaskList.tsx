"use client";
/**
 * @file SubtaskList.tsx — features/task-details
 *
 * ОБНОВЛЕНИЕ v2 — полный CRUD подзадач:
 *  - Переключение (toggle) — без изменений, через store
 *  - Добавление  — инлайн input "+ Добавить подзадачу"
 *  - Удаление    — крестик появляется при наведении на строку
 *
 * Все мутации идут через useTaskStore (offline-first + optimistic).
 */
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { SubtaskView } from "@/shared/types";

interface Props {
  taskId:   number;
  subtasks: SubtaskView[];
}

// ── Single subtask row ─────────────────────────────────────────────────────────

function SubtaskRow({
  subtask,
  onToggle,
  onDelete,
}: {
  subtask: SubtaskView;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      variants={{
        hidden:   { opacity: 0, x: -8 },
        visible:  { opacity: 1, x: 0, transition: { duration: 0.2 } },
      }}
      className="group flex items-start gap-3 px-2 py-2 rounded-xl cursor-pointer transition-colors hover:bg-[var(--glass-01)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "mt-0.5 w-4 h-4 rounded-md shrink-0 flex items-center justify-center transition-all duration-200 border",
          subtask.isCompleted
            ? "bg-[var(--accent-500)] border-[var(--accent-500)] shadow-[0_0_8px_var(--accent-glow)]"
            : "border-[var(--glass-border-active)] bg-[var(--glass-01)] group-hover:border-[var(--accent-500)]"
        )}
      >
        <AnimatePresence>
          {subtask.isCompleted && (
            <motion.svg
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "backOut" }}
              className="w-2.5 h-2.5 text-white"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1.5 5l2.5 2.5 4.5-4.5" />
            </motion.svg>
          )}
        </AnimatePresence>
      </div>

      {/* Title */}
      <motion.span
        layout
        className={cn(
          "text-sm leading-relaxed flex-1 transition-colors duration-300 select-none",
          subtask.isCompleted
            ? "line-through text-[var(--text-muted)]"
            : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
        )}
      >
        {subtask.title}
      </motion.span>

      {/* Temp badge */}
      {subtask.id < 0 && (
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 self-center"
          style={{ background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.25)" }}
        >
          pending
        </span>
      )}

      {/* Delete button */}
      <AnimatePresence>
        {hovered && subtask.id > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.12 }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center self-center"
            style={{
              color:      "var(--text-muted)",
              background: "transparent",
            }}
            whileHover={{
              color:      "#f87171",
              background: "rgba(239,68,68,0.10)",
            }}
            title="Удалить подзадачу"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l8 8M10 2L2 10" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Add subtask inline input ───────────────────────────────────────────────────

function AddSubtaskInput({
  onAdd,
  onCancel,
}: {
  onAdd: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) { onAdd(trimmed); setValue(""); }
    else onCancel();
  }, [value, onAdd, onCancel]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-3 px-2 py-2 rounded-xl"
      style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border-active)" }}
    >
      {/* Placeholder checkbox */}
      <div className="w-4 h-4 rounded-md border border-[var(--glass-border-active)] shrink-0" />

      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onBlur={() => { if (!value.trim()) onCancel(); else submit(); }}
        placeholder="Название подзадачи..."
        maxLength={200}
        className="flex-1 text-sm bg-transparent outline-none"
        style={{ color: "var(--text-primary)" }}
      />

      <div className="flex items-center gap-1 shrink-0">
        <kbd
          className="px-1.5 py-0.5 rounded text-[10px] font-mono"
          style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
        >
          ↵
        </kbd>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SubtaskList({ taskId, subtasks }: Props) {
  const toggleSubtask  = useTaskStore((s) => s.toggleSubtask);
  const addSubtask     = useTaskStore((s) => s.addSubtask);
  const deleteSubtask  = useTaskStore((s) => s.deleteSubtask);
  const [adding, setAdding] = useState(false);

  const done  = subtasks.filter((s) => s.isCompleted).length;
  const total = subtasks.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = useCallback((title: string) => {
    addSubtask(taskId, title);
    // keep adding open for rapid entry
  }, [addSubtask, taskId]);

  if (subtasks.length === 0 && !adding) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[var(--text-muted)] text-center py-4">
          Нет подзадач
        </p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 w-full px-2 py-2 rounded-xl text-xs font-medium transition-all"
          style={{
            border:  "1px dashed var(--glass-border)",
            color:   "var(--text-muted)",
          }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Добавить подзадачу
        </button>
        <AnimatePresence>
          {adding && (
            <AddSubtaskInput
              onAdd={(title) => { handleAdd(title); }}
              onCancel={() => setAdding(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
          Подзадачи
        </span>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          {done}/{total} · {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-[var(--glass-02)] rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, var(--accent-500), var(--accent-400))" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* List */}
      <motion.div
        className="space-y-1"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
      >
        {subtasks.map((st) => (
          <SubtaskRow
            key={st.id}
            subtask={st}
            onToggle={() => toggleSubtask(taskId, st.id, st.isCompleted)}
            onDelete={() => deleteSubtask(taskId, st.id)}
          />
        ))}
      </motion.div>

      {/* Add input or button */}
      <div className="pt-1">
        <AnimatePresence mode="wait">
          {adding ? (
            <AddSubtaskInput
              key="input"
              onAdd={(title) => { handleAdd(title); }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <motion.button
              key="btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                border: "1px dashed var(--glass-border)",
                color:  "var(--text-muted)",
              }}
              whileHover={{
                borderColor: "rgba(139,92,246,0.4)",
                color:       "var(--accent-400)",
              }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M7 1v12M1 7h12" />
              </svg>
              Добавить подзадачу
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}