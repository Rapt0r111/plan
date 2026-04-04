"use client";
/**
 * @file QuickAddTask.tsx — widgets/board
 *
 * v4 — Offline read-only guard:
 *   При офлайн-режиме кнопка «Добавить задачу» показывает замок
 *   и нажатие блокируется. Форма ввода не открывается.
 *   Логика добавления задач/подзадач не изменилась.
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { PRIORITY_META, PRIORITY_ORDER } from "@/shared/config/task-meta";
import { suggestPriority } from "@/features/ai/useAISuggestions";
import { useIsOffline } from "@/shared/lib/hooks/useIsOffline";
import type { TaskStatus, TaskPriority, TaskView } from "@/shared/types";
import { type UserOption } from "@/shared/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  epicId:        number;
  defaultStatus?: TaskStatus;
  epicColor?:    string;
  onCreated?:    (task: TaskView) => void;
}

const SUBTASK_PRESETS = [1, 2, 3, 4, 5] as const;
type SubtaskCount = (typeof SUBTASK_PRESETS)[number];
const DEFAULT_SUBTASK_COUNT: SubtaskCount = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PriorityChip({
  priority, active, onClick,
}: { priority: TaskPriority; active: boolean; onClick: () => void }) {
  const meta = PRIORITY_META[priority];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.07 }}
      whileTap={{ scale: 0.94 }}
      className="quick-add-priority-chip"
      style={active ? {
        background:  `${meta.color}22`,
        color:       meta.color,
        borderColor: `${meta.color}44`,
        boxShadow:   `0 0 8px ${meta.color}28`,
      } : undefined}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: active ? meta.color : "var(--text-muted)" }}
      />
      {meta.label}
    </motion.button>
  );
}

function AssigneeChip({
  user, selected, onClick,
}: { user: UserOption; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.9 }}
      title={`${user.name} — ${user.roleMeta.label}`}
      className="relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white outline-none"
      style={{
        backgroundColor: user.roleMeta.hex,
        boxShadow: selected
          ? `0 0 0 2px var(--bg-overlay), 0 0 0 3.5px ${user.roleMeta.hex}, 0 0 10px ${user.roleMeta.hex}55`
          : "0 0 0 1.5px rgba(0,0,0,0.25)",
        opacity: selected ? 1 : 0.45,
      }}
    >
      {user.initials}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.12, type: "spring", stiffness: 500 }}
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full flex items-center justify-center"
            style={{ background: user.roleMeta.hex, border: "1px solid var(--bg-overlay)" }}
          >
            <svg className="w-1.5 h-1.5" viewBox="0 0 6 6" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 3l1.5 1.5 2.5-2.5" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function SubtaskPresets({
  count,
  onCountChange,
  subtaskStates,
  onSubtaskToggle,
  epicColor,
}: {
  count:           SubtaskCount;
  onCountChange:   (n: SubtaskCount) => void;
  subtaskStates:   boolean[];
  onSubtaskToggle: (index: number) => void;
  epicColor:       string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium shrink-0" style={{ color: "var(--text-muted)" }}>
          Подзадачи:
        </span>
        <div className="flex items-center gap-1">
          {SUBTASK_PRESETS.map((n) => (
            <motion.button
              key={n}
              type="button"
              onClick={() => onCountChange(n)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
              style={
                count === n
                  ? {
                      background:  `${epicColor}22`,
                      color:       epicColor,
                      border:      `1px solid ${epicColor}44`,
                      boxShadow:   `0 0 8px ${epicColor}28`,
                    }
                  : {
                      background:  "var(--glass-01)",
                      color:       "var(--text-muted)",
                      border:      "1px solid var(--glass-border)",
                    }
              }
            >
              {n}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {Array.from({ length: count }, (_, i) => (
          <motion.label
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => onSubtaskToggle(i)}
          >
            <div
              className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-all duration-150"
              style={
                subtaskStates[i]
                  ? {
                      background:  epicColor,
                      borderColor: epicColor,
                      boxShadow:   `0 0 6px ${epicColor}55`,
                    }
                  : {
                      background:  "transparent",
                      borderColor: "var(--glass-border-active)",
                    }
              }
            >
              <AnimatePresence>
                {subtaskStates[i] && (
                  <motion.svg
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.1, type: "spring", stiffness: 600 }}
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
              className="text-xs transition-all duration-150"
              style={{
                color:          subtaskStates[i] ? "var(--text-muted)" : "var(--text-secondary)",
                textDecoration: subtaskStates[i] ? "line-through" : "none",
              }}
            >
              Подзадача {i + 1}
            </span>
            {subtaskStates[i] && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: `${epicColor}18`, color: epicColor }}
              >
                готово
              </motion.span>
            )}
          </motion.label>
        ))}
      </div>
    </div>
  );
}

// ─── Hook: lazy-fetch users ───────────────────────────────────────────────────

function useUsers() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fetched, setFetched] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (fetched) return;
    try {
      const res  = await fetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data ?? []);
      }
    } finally {
      setFetched(true);
    }
  }, [fetched]);

  return { users, fetchUsers };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function QuickAddTask({ epicId, defaultStatus = "todo", epicColor, onCreated }: Props) {
  const offline = useIsOffline();

  const [open, setOpen]               = useState(false);
  const [title, setTitle]             = useState("");
  const [priority, setPriority]       = useState<TaskPriority>("medium");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [metaVisible, setMetaVisible] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [suggestedPriority, setSuggestedPriority] = useState<TaskPriority | null>(null);
  const priorityTouchedRef = useRef(false);

  const [subtaskCount, setSubtaskCount] = useState<SubtaskCount>(DEFAULT_SUBTASK_COUNT);
  const [subtaskEnabled, setSubtaskEnabled] = useState(false);
  const [subtaskStates, setSubtaskStates]   = useState<boolean[]>(
    Array(DEFAULT_SUBTASK_COUNT).fill(false)
  );

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const createTaskWithSubtasks = useTaskStore((s) => s.createTaskWithSubtasks);
  const { users, fetchUsers } = useUsers();

  const accentHex = epicColor ?? "#8b5cf6";

  const handleSubtaskCountChange = useCallback((n: SubtaskCount) => {
    setSubtaskCount(n);
    setSubtaskStates((prev) => {
      if (n > prev.length) return [...prev, ...Array(n - prev.length).fill(false)];
      return prev.slice(0, n);
    });
  }, []);

  const handleSubtaskToggle = useCallback((index: number) => {
    setSubtaskStates((prev) => prev.map((v, i) => i === index ? !v : v));
  }, []);

  const toggleAssignee = useCallback((id: number) => {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const handleOpen = useCallback(() => {
    // ✅ OFFLINE GUARD: don't open form when offline (store also guards, but UX is cleaner)
    if (offline) return;
    setOpen(true);
    fetchUsers();
    requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
  }, [fetchUsers, offline]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTitle("");
    setMetaVisible(false);
    setSuggestedPriority(null);
    priorityTouchedRef.current = false;
    setAssigneeIds([]);
    setSubtaskEnabled(false);
    setSubtaskCount(DEFAULT_SUBTASK_COUNT);
    setSubtaskStates(Array(DEFAULT_SUBTASK_COUNT).fill(false));
  }, []);

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setTitle(val);
    if (priorityTouchedRef.current) return;
    const suggested = suggestPriority(val);
    if (suggested) { setPriority(suggested); setSuggestedPriority(suggested); }
    else            { setPriority("medium");  setSuggestedPriority(null);     }
  }

  function handlePriorityClick(p: TaskPriority) {
    priorityTouchedRef.current = true;
    setPriority(p);
    setSuggestedPriority(null);
  }

  const handleSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setTitle("");
    inputRef.current?.focus();

    try {
      const subtasks = subtaskEnabled
        ? subtaskStates.slice(0, subtaskCount).map((isCompleted, i) => ({
            isCompleted,
            sortOrder: i,
          }))
        : [];

      const task = await createTaskWithSubtasks({
        epicId,
        title:       trimmed,
        status:      defaultStatus,
        priority,
        assigneeIds,
        subtasks,
      });

      if (!task) { setTitle(trimmed); return; }

      onCreated?.(task);
      setSuggestedPriority(null);
      priorityTouchedRef.current = false;
      setPriority("medium");
      setAssigneeIds([]);
      setSubtaskEnabled(false);
      setSubtaskCount(DEFAULT_SUBTASK_COUNT);
      setSubtaskStates(Array(DEFAULT_SUBTASK_COUNT).fill(false));
    } catch {
      setTitle(trimmed);
    } finally {
      setSaving(false);
    }
  }, [
    title, saving, createTaskWithSubtasks, epicId, defaultStatus, priority,
    assigneeIds, subtaskEnabled, subtaskStates, subtaskCount, onCreated,
  ]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter")  { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { e.preventDefault(); handleClose(); }
  }, [handleSave, handleClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, handleClose]);

  // Close form if user goes offline mid-input
  useEffect(() => {
    if (offline && open) handleClose();
  }, [offline, open, handleClose]);

  return (
    <div
      ref={containerRef}
      style={{ "--quick-add-accent": accentHex } as React.CSSProperties}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          /* ── TRIGGER BUTTON ─────────────────────────────────────── */
          <motion.button
            key="trigger"
            type="button"
            onClick={handleOpen}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            whileTap={offline ? {} : { scale: 0.98 }}
            disabled={offline}
            className="quick-add-trigger"
            style={offline ? { opacity: 0.45, cursor: "not-allowed", pointerEvents: "none" } : undefined}
            title={offline ? "Недоступно в офлайн-режиме" : undefined}
          >
            {offline ? (
              /* Lock icon when offline */
              <svg
                className="quick-add-trigger-icon"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <rect x="2" y="6" width="10" height="7" rx="1.5" />
                <path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" />
              </svg>
            ) : (
              <motion.span
                className="quick-add-trigger-icon"
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.18 }}
              >
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M5 1v8M1 5h8" />
                </svg>
              </motion.span>
            )}
            {offline ? "Только просмотр" : "Добавить задачу"}
          </motion.button>
        ) : (
          /* ── INPUT CARD ─────────────────────────────────────────── */
          <motion.div
            key="card"
            layout
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="quick-add-card"
          >
            <motion.div
              className="quick-add-accent-line"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.04 }}
            />

            <div className="px-3 pt-2.5 pb-3 space-y-2">
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={handleTitleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setMetaVisible(true)}
                placeholder="Название задачи..."
                maxLength={200}
                disabled={saving}
                className="quick-add-input disabled:opacity-50"
              />

              <AnimatePresence>
                {suggestedPriority && (
                  <motion.p
                    key={suggestedPriority}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="text-[10px] flex items-center gap-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span style={{ color: PRIORITY_META[suggestedPriority].color }}>✦</span>
                    AI предлагает:{" "}
                    <span className="font-semibold" style={{ color: PRIORITY_META[suggestedPriority].color }}>
                      {PRIORITY_META[suggestedPriority].label}
                    </span>
                  </motion.p>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {metaVisible && (
                  <motion.div
                    key="meta"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-1 space-y-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-medium shrink-0 mr-0.5" style={{ color: "var(--text-muted)" }}>
                          Приоритет:
                        </span>
                        {PRIORITY_ORDER.map((p) => (
                          <PriorityChip
                            key={p}
                            priority={p}
                            active={priority === p}
                            onClick={() => handlePriorityClick(p)}
                          />
                        ))}
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => setSubtaskEnabled((v) => !v)}
                          className="flex items-center gap-1.5 text-[10px] font-medium transition-colors"
                          style={{ color: subtaskEnabled ? accentHex : "var(--text-muted)" }}
                        >
                          <motion.div
                            animate={{ rotate: subtaskEnabled ? 90 : 0 }}
                            transition={{ duration: 0.15 }}
                            className="w-3.5 h-3.5 rounded flex items-center justify-center"
                            style={{
                              background:  subtaskEnabled ? `${accentHex}22` : "var(--glass-01)",
                              border:      `1px solid ${subtaskEnabled ? accentHex + "44" : "var(--glass-border)"}`,
                            }}
                          >
                            <svg className="w-2 h-2" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                              <path d="M4 1v6M1 4h6" />
                            </svg>
                          </motion.div>
                          Подзадачи
                          {subtaskEnabled && (
                            <span
                              className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                              style={{ background: `${accentHex}18`, color: accentHex }}
                            >
                              {subtaskCount}
                            </span>
                          )}
                        </button>

                        <AnimatePresence>
                          {subtaskEnabled && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                              className="overflow-hidden mt-2"
                            >
                              <SubtaskPresets
                                count={subtaskCount}
                                onCountChange={handleSubtaskCountChange}
                                subtaskStates={subtaskStates}
                                onSubtaskToggle={handleSubtaskToggle}
                                epicColor={accentHex}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {users.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                            Исполнители:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {users.map((u) => (
                              <AssigneeChip
                                key={u.id}
                                user={u}
                                selected={assigneeIds.includes(u.id)}
                                onClick={() => toggleAssignee(u.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-1.5">
                  <kbd className="quick-add-kbd">↵</kbd>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>сохранить</span>
                  <span className="text-[10px] opacity-30" style={{ color: "var(--text-muted)" }}>·</span>
                  <kbd className="quick-add-kbd">Esc</kbd>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>отмена</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <motion.button
                    type="button"
                    onClick={handleClose}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="quick-add-cancel-btn"
                  >
                    Отмена
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleSave}
                    disabled={!title.trim() || saving}
                    whileHover={title.trim() && !saving ? { scale: 1.04 } : {}}
                    whileTap={title.trim() && !saving ? { scale: 0.96 } : {}}
                    className="quick-add-save-btn"
                    style={{ opacity: saving ? 0.72 : 1 }}
                  >
                    {saving && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: "linear-gradient(90deg, transparent 30%, var(--glass-border-active) 50%, transparent 70%)" }}
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                    {saving ? "Сохраняю..." : "Добавить"}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}