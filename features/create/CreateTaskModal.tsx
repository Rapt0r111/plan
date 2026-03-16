"use client";
/**
 * CreateTaskModal — создание задачи из любого места.
 * Эпик выбирается из выпадающего списка с живым поиском.
 * MULTI-ASSIGNEE: исполнители выбираются chip-пикером с мультивыбором.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META } from "@/shared/config/task-meta";
import { suggestPriority } from "@/features/ai/useAISuggestions";
import type { TaskStatus, TaskPriority } from "@/shared/types";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultEpicId?: number;
}

interface UserOption {
  id: number;
  name: string;
  initials: string;
  roleMeta: { hex: string; label: string; short: string };
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "К работе" },
  { value: "in_progress", label: "В работе" },
  { value: "done", label: "Готово" },
  { value: "blocked", label: "Заблокировано" },
];

// ── Assignee chip ──────────────────────────────────────────────────────────────
function AssigneeChip({
  user,
  selected,
  onClick,
}: {
  user: UserOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={`${user.name} — ${user.roleMeta.label}`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="relative flex flex-col items-center gap-1 focus:outline-none"
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all duration-150"
        style={{
          backgroundColor: user.roleMeta.hex,
          boxShadow: selected
            ? `0 0 0 2px var(--bg-surface), 0 0 0 3.5px ${user.roleMeta.hex}, 0 0 12px ${user.roleMeta.hex}60`
            : "0 0 0 1.5px rgba(0,0,0,0.25)",
          opacity: selected ? 1 : 0.45,
          transform: selected ? "scale(1.08)" : "scale(1)",
        }}
      >
        {user.initials}
      </div>
      {/* Check indicator */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15, type: "spring", stiffness: 500 }}
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
            style={{ background: user.roleMeta.hex, border: "1.5px solid var(--bg-surface)" }}
          >
            <svg className="w-2 h-2" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1.5 4l2 2 3-3" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Name */}
      <span
        className="text-[9px] font-medium max-w-[48px] truncate text-center leading-tight"
        style={{ color: selected ? "var(--text-secondary)" : "var(--text-muted)" }}
      >
        {user.name.split(" ")[0]}
      </span>
    </motion.button>
  );
}

// ── Selected assignees preview ─────────────────────────────────────────────────
function SelectedAssigneesBar({
  users,
  selectedIds,
  onRemove,
}: {
  users: UserOption[];
  selectedIds: number[];
  onRemove: (id: number) => void;
}) {
  if (!selectedIds.length) return null;
  const selected = users.filter((u) => selectedIds.includes(u.id));

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-1.5 flex-wrap overflow-hidden"
    >
      {selected.map((u) => (
        <motion.div
          key={u.id}
          layout
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{
            background: `${u.roleMeta.hex}18`,
            border: `1px solid ${u.roleMeta.hex}35`,
            color: u.roleMeta.hex,
          }}
        >
          <div
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
            style={{ backgroundColor: u.roleMeta.hex }}
          >
            {u.initials}
          </div>
          {u.name.split(" ")[0]}
          <button
            onClick={() => onRemove(u.id)}
            className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l6 6M8 2L2 8" />
            </svg>
          </button>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function CreateTaskModal({ open, onClose, defaultEpicId }: Props) {
  const epics = useTaskStore(s => s.epics);
  const createTask = useTaskStore(s => s.createTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [epicId, setEpicId] = useState<number | null>(defaultEpicId ?? null);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersFetched, setUsersFetched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSuggested, setAiSuggested] = useState<TaskPriority | null>(null);
  const priorityTouched = useRef(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const selectedEpic = epics.find(e => e.id === epicId);
  const accentColor = selectedEpic?.color ?? "#8b5cf6";

  // Fetch users once on open
  useEffect(() => {
    if (!open || usersFetched) return;
    fetch("/api/users")
      .then(r => r.json())
      .then(d => { if (d.data) setUsers(d.data); })
      .catch(() => {})
      .finally(() => setUsersFetched(true));
  }, [open, usersFetched]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      if (defaultEpicId) setEpicId(defaultEpicId);
    } else {
      setTitle(""); setDescription(""); setStatus("todo"); setPriority("medium");
      setDueDate(""); setError(null); setAiSuggested(null); setAssigneeIds([]);
      priorityTouched.current = false;
    }
  }, [open, defaultEpicId]);

  const toggleAssignee = useCallback((id: number) => {
    setAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (priorityTouched.current) return;
    const suggested = suggestPriority(val);
    if (suggested) {
      setPriority(suggested);
      setAiSuggested(suggested);
    } else {
      setPriority("medium");
      setAiSuggested(null);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim() || !epicId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const task = await createTask({ epicId, title: title.trim(), status, priority });
      if (!task) throw new Error("Не удалось создать задачу");

      // Patch description / dueDate
      if (dueDate || description.trim()) {
        await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(dueDate && { dueDate }),
            ...(description.trim() && { description: description.trim() }),
          }),
        });
      }

      // Add all selected assignees in parallel
      if (assigneeIds.length) {
        await Promise.all(
          assigneeIds.map(userId =>
            fetch(`/api/tasks/${task.id}/assignees`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
            })
          )
        );
      }

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }, [title, epicId, status, priority, dueDate, description, assigneeIds, saving, createTask, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
  }, [onClose, handleSave]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[9500]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "var(--modal-backdrop)", backdropFilter: "blur(8px)" }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-0 z-[9501] flex items-center justify-center p-4"
            style={{ pointerEvents: "none" }}
          >
            <motion.div
              className="w-full max-w-lg relative rounded-3xl overflow-hidden"
              style={{
                pointerEvents: "auto",
                background: "var(--modal-bg)",
                border: `1px solid ${accentColor}30`,
                boxShadow: `0 0 0 1px ${accentColor}12, 0 32px 80px rgba(0,0,0,0.7)`,
              }}
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onKeyDown={handleKeyDown}
            >
              {/* Top line */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
              />
              <div
                className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${accentColor}10 0%, transparent 70%)` }}
              />

              <div className="relative px-6 pt-6 pb-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40` }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke={accentColor} strokeWidth="1.7" strokeLinecap="round">
                        <rect x="2" y="2" width="12" height="12" rx="2.5" />
                        <path d="M5 8h6M5 5.5h3" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        Новая задача
                      </h2>
                      {selectedEpic && (
                        <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: selectedEpic.color }} />
                          {selectedEpic.title}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-xl flex items-center justify-center hover:opacity-70 transition-opacity"
                    style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M2 2l8 8M10 2L2 10" />
                    </svg>
                  </button>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs px-3 py-2 rounded-lg"
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Title */}
                <input
                  ref={inputRef}
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="Название задачи..."
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                  style={{
                    background: "var(--glass-01)",
                    border: `1px solid ${title ? accentColor + "50" : "var(--glass-border)"}`,
                    color: "var(--text-primary)",
                    caretColor: accentColor,
                    boxShadow: title ? `0 0 0 3px ${accentColor}10` : "none",
                  }}
                />

                {/* AI hint */}
                <AnimatePresence>
                  {aiSuggested && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 text-xs overflow-hidden"
                    >
                      <span style={{ color: PRIORITY_META[aiSuggested].color }}>✦ AI:</span>
                      <span style={{ color: "var(--text-muted)" }}>
                        предлагает приоритет{" "}
                        <span className="font-semibold" style={{ color: PRIORITY_META[aiSuggested].color }}>
                          {PRIORITY_META[aiSuggested].label}
                        </span>
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Epic select */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "var(--text-muted)" }}>
                    Эпик *
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {epics.map(epic => (
                      <motion.button
                        key={epic.id}
                        type="button"
                        onClick={() => setEpicId(epic.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-left transition-all"
                        style={{
                          background: epicId === epic.id ? `${epic.color}18` : "var(--glass-01)",
                          border: `1px solid ${epicId === epic.id ? epic.color + "45" : "var(--glass-border)"}`,
                          color: epicId === epic.id ? epic.color : "var(--text-secondary)",
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: epic.color }} />
                        <span className="truncate">{epic.title}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Status + Priority row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "var(--text-muted)" }}>
                      Статус
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {STATUS_OPTIONS.map(opt => {
                        const meta = STATUS_META[opt.value];
                        return (
                          <motion.button
                            key={opt.value}
                            type="button"
                            onClick={() => setStatus(opt.value)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
                            style={{
                              background: status === opt.value ? meta.bg : "var(--glass-01)",
                              border: `1px solid ${status === opt.value ? meta.border : "var(--glass-border)"}`,
                              color: status === opt.value ? meta.color : "var(--text-muted)",
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.solid }} />
                            {opt.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "var(--text-muted)" }}>
                      Приоритет
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {PRIORITY_ORDER.map(p => {
                        const meta = PRIORITY_META[p];
                        return (
                          <motion.button
                            key={p}
                            type="button"
                            onClick={() => {
                              priorityTouched.current = true;
                              setPriority(p);
                              setAiSuggested(null);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
                            style={{
                              background: priority === p ? meta.bg : "var(--glass-01)",
                              border: `1px solid ${priority === p ? meta.border : "var(--glass-border)"}`,
                              color: priority === p ? meta.color : "var(--text-muted)",
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                            {meta.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Description + Due date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "var(--text-muted)" }}>
                      Описание
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Детали задачи..."
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none transition-all"
                      style={{
                        background: "var(--glass-01)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-sans)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "var(--text-muted)" }}>
                      Дедлайн
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none transition-all"
                      style={{
                        background: "var(--glass-01)",
                        border: "1px solid var(--glass-border)",
                        color: dueDate ? "var(--text-primary)" : "var(--text-muted)",
                        colorScheme: "dark",
                      }}
                    />
                  </div>
                </div>

                {/* ── Assignees ── */}
                {users.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                        Исполнители
                      </label>
                      {assigneeIds.length > 0 && (
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                          style={{ background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}30` }}
                        >
                          {assigneeIds.length} выбран{assigneeIds.length === 1 ? "" : assigneeIds.length < 5 ? "о" : "о"}
                        </span>
                      )}
                    </div>

                    {/* Selected bar */}
                    <AnimatePresence>
                      {assigneeIds.length > 0 && (
                        <div className="mb-2.5">
                          <SelectedAssigneesBar
                            users={users}
                            selectedIds={assigneeIds}
                            onRemove={toggleAssignee}
                          />
                        </div>
                      )}
                    </AnimatePresence>

                    {/* Chip grid */}
                    <div
                      className="flex flex-wrap gap-3 p-3 rounded-xl"
                      style={{
                        background: "var(--glass-01)",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
                      {users.map(u => (
                        <AssigneeChip
                          key={u.id}
                          user={u}
                          selected={assigneeIds.includes(u.id)}
                          onClick={() => toggleAssignee(u.id)}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                      Нажмите на аватар чтобы добавить или убрать исполнителя
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "var(--glass-border)" }}>
                  <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)" }}>
                      ⌘↵
                    </kbd>
                    создать
                  </span>
                  <div className="flex gap-2">
                    <motion.button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-xs font-medium"
                      style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    >
                      Отмена
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleSave}
                      disabled={!title.trim() || !epicId || saving}
                      className="relative px-5 py-2 rounded-xl text-xs font-semibold overflow-hidden"
                      style={{
                        background: title.trim() && epicId ? `${accentColor}25` : "var(--glass-01)",
                        border: `1px solid ${title.trim() && epicId ? accentColor + "50" : "var(--glass-border)"}`,
                        color: title.trim() && epicId ? accentColor : "var(--text-muted)",
                        opacity: saving ? 0.7 : 1,
                      }}
                      whileHover={title.trim() && epicId && !saving ? { scale: 1.03 } : {}}
                      whileTap={title.trim() && epicId && !saving ? { scale: 0.97 } : {}}
                    >
                      {saving ? "Создаю..." : "Создать задачу"}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}