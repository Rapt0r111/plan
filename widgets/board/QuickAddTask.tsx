"use client";
/**
 * @file QuickAddTask.tsx — widgets/board
 *
 * Морфирующая карточка быстрого создания задачи.
 * Стили — исключительно через CSS-классы globals.css.
 * Единственный inline-style: --quick-add-accent на корне (передаёт
 * цвет эпика в дочерние CSS-классы через color-mix / linear-gradient).
 *
 * Поддерживает dark / light тему автоматически через CSS-переменные.
 *
 * NEW: AI-подсказка приоритета — эвристика по тексту задачи без API.
 *   suggestPriority() вызывается на каждый onChange и если приоритет
 *   ещё не трогали (=== "medium") — автовыставляет + показывает hint.
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
import type { TaskStatus, TaskPriority, TaskView } from "@/shared/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserOption {
  id: number;
  name: string;
  initials: string;
  roleMeta: { hex: string; label: string };
}

interface Props {
  epicId: number;
  defaultStatus?: TaskStatus;
  epicColor?: string;
  onCreated?: (task: TaskView) => void;
}

// ─── PriorityChip ─────────────────────────────────────────────────────────────

function PriorityChip({
  priority,
  active,
  onClick,
}: {
  priority: TaskPriority;
  active: boolean;
  onClick: () => void;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.07 }}
      whileTap={{ scale: 0.94 }}
      className="quick-add-priority-chip"
      style={
        active
          ? {
              background:   `${meta.color}22`,
              color:         meta.color,
              borderColor:  `${meta.color}44`,
              boxShadow:    `0 0 8px ${meta.color}28`,
            }
          : undefined
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: active ? meta.color : "var(--text-muted)" }}
      />
      {meta.label}
    </motion.button>
  );
}

// ─── AssigneeChip ─────────────────────────────────────────────────────────────

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
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.9 }}
      title={`${user.name} — ${user.roleMeta.label}`}
      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white outline-none transition-all duration-150"
      style={{
        backgroundColor: user.roleMeta.hex,
        boxShadow: selected
          ? `0 0 0 2px var(--bg-overlay), 0 0 0 3.5px ${user.roleMeta.hex}`
          : "0 0 0 1.5px rgba(0,0,0,0.25)",
        opacity: selected ? 1 : 0.5,
      }}
    >
      {user.initials}
    </motion.button>
  );
}

// ─── Hook: lazy-fetch users ───────────────────────────────────────────────────

function useUsers() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fetched, setFetched] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (fetched) return;
    try {
      const res = await fetch("/api/users");
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

export function QuickAddTask({
  epicId,
  defaultStatus = "todo",
  epicColor,
  onCreated,
}: Props) {
  const [open,              setOpen]              = useState(false);
  const [title,             setTitle]             = useState("");
  const [priority,          setPriority]          = useState<TaskPriority>("medium");
  const [assigneeId,        setAssigneeId]        = useState<number | null>(null);
  const [metaVisible,       setMetaVisible]       = useState(false);
  const [saving,            setSaving]            = useState(false);
  // null = нет подсказки; строка = AI что-то предложил
  const [suggestedPriority, setSuggestedPriority] = useState<TaskPriority | null>(null);
  // флаг: пользователь сам кликал на chip — не перезаписываем AI-подсказкой
  const priorityTouchedRef = useRef(false);

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const createTask   = useTaskStore((s) => s.createTask);
  const { users, fetchUsers } = useUsers();

  const accentHex = epicColor ?? "#8b5cf6";

  // ── Open / Close ────────────────────────────────────────────────────────
  const handleOpen = useCallback(() => {
    setOpen(true);
    fetchUsers();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => inputRef.current?.focus()),
    );
  }, [fetchUsers]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTitle("");
    setMetaVisible(false);
    setSuggestedPriority(null);
    priorityTouchedRef.current = false;
  }, []);

  // ── AI-подсказка ────────────────────────────────────────────────────────
  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setTitle(val);

    // Не перезаписываем выбор пользователя
    if (priorityTouchedRef.current) return;

    const suggested = suggestPriority(val);
    if (suggested) {
      setPriority(suggested);
      setSuggestedPriority(suggested);
    } else {
      // Текст стёрт / паттерн исчез — вернуть дефолт и убрать hint
      setPriority("medium");
      setSuggestedPriority(null);
    }
  }

  // Обёртка для ручного выбора chip'а
  function handlePriorityClick(p: TaskPriority) {
    priorityTouchedRef.current = true;
    setPriority(p);
    setSuggestedPriority(null); // hint больше не нужен
  }

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setTitle(""); // optimistic field reset
    inputRef.current?.focus();

    try {
      const task = await createTask({
        epicId,
        title: trimmed,
        status: defaultStatus,
        priority,
      });
      if (task && assigneeId !== null) {
        const user = users.find((u) => u.id === assigneeId);
        if (user) {
          useTaskStore
            .getState()
            .addAssignee(task.id, user as TaskView["assignees"][0]);
        }
      }
      onCreated?.(task!);
      setSuggestedPriority(null);
      priorityTouchedRef.current = false;
      setPriority("medium");
    } catch {
      setTitle(trimmed); // rollback только поля при ошибке
    } finally {
      setSaving(false);
    }
  }, [title, saving, createTask, epicId, defaultStatus, priority, assigneeId, users, onCreated]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter")  { e.preventDefault(); handleSave();  }
      if (e.key === "Escape") { e.preventDefault(); handleClose(); }
    },
    [handleSave, handleClose],
  );

  // ── Click outside ───────────────────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ "--quick-add-accent": accentHex } as React.CSSProperties}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          /* ── КНОПКА-ТРИГГЕР ────────────────────────────────────────── */
          <motion.button
            key="trigger"
            type="button"
            onClick={handleOpen}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            whileTap={{ scale: 0.98 }}
            className="quick-add-trigger"
          >
            <motion.span
              className="quick-add-trigger-icon"
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.18 }}
            >
              <svg
                className="w-2.5 h-2.5"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M5 1v8M1 5h8" />
              </svg>
            </motion.span>
            Добавить задачу
          </motion.button>
        ) : (
          /* ── КАРТОЧКА ВВОДА ────────────────────────────────────────── */
          <motion.div
            key="card"
            layout
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="quick-add-card"
          >
            {/* Цветная полоска */}
            <motion.div
              className="quick-add-accent-line"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.04 }}
            />

            <div className="px-3 pt-2.5 pb-3 space-y-2">
              {/* Input */}
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

              {/* AI hint — появляется под инпутом когда эвристика сработала */}
              <AnimatePresence>
                {suggestedPriority && (
                  <motion.p
                    key={suggestedPriority}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1,  y: 0  }}
                    exit={{   opacity: 0,  y: -4  }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="text-[10px] flex items-center gap-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span style={{ color: PRIORITY_META[suggestedPriority].color }}>
                      ✦
                    </span>
                    AI предлагает:{" "}
                    <span
                      className="font-semibold"
                      style={{ color: PRIORITY_META[suggestedPriority].color }}
                    >
                      {PRIORITY_META[suggestedPriority].label}
                    </span>
                    <span className="opacity-50">· нажмите на chip чтобы изменить</span>
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Прогрессивное раскрытие */}
              <AnimatePresence>
                {metaVisible && (
                  <motion.div
                    key="meta"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{   opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-1 space-y-2">
                      {/* Приоритет */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-[10px] font-medium shrink-0 mr-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
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

                      {/* Исполнители */}
                      {users.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[10px] font-medium shrink-0 mr-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Исполнитель:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {users.map((u) => (
                              <AssigneeChip
                                key={u.id}
                                user={u}
                                selected={assigneeId === u.id}
                                onClick={() =>
                                  setAssigneeId((prev) => (prev === u.id ? null : u.id))
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="flex items-center justify-between pt-0.5">
                {/* Kbd hints */}
                <div className="flex items-center gap-1.5">
                  <kbd className="quick-add-kbd">↵</kbd>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    сохранить
                  </span>
                  <span className="text-[10px] opacity-30" style={{ color: "var(--text-muted)" }}>·</span>
                  <kbd className="quick-add-kbd">Esc</kbd>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    отмена
                  </span>
                </div>

                {/* Кнопки */}
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
                    whileTap={title.trim()   && !saving ? { scale: 0.96 } : {}}
                    className="quick-add-save-btn"
                    style={{ opacity: saving ? 0.72 : 1 }}
                  >
                    {/* Shimmer при сохранении */}
                    {saving && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(90deg, transparent 30%, var(--glass-border-active) 50%, transparent 70%)",
                        }}
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