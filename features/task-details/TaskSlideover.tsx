"use client";
/**
 * @file TaskSlideover.tsx — features/task-details
 *
 * v4 FULL EDIT — все поля задачи редактируемы прямо в слайдере:
 *   • Заголовок — inline click-to-edit, Enter/blur = сохранить
 *   • Описание  — textarea, появляется по клику, blur = сохранить
 *   • Статус    — pill-кнопки (оптимистично)
 *   • Приоритет — pill-кнопки (оптимистично)
 *   • Дедлайн   — нативный date-input + кнопка сброса
 *   • Исполнители — список с удалением + кнопка «Добавить» → dropdown из /api/users
 *   • Подзадачи — SubtaskList (чекбоксы + добавление)
 */
import {
  useState, useRef, useEffect, useCallback,
  type KeyboardEvent, type ChangeEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { SubtaskList } from "./SubtaskList";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { STATUS_META, PRIORITY_META, STATUS_ORDER, PRIORITY_ORDER } from "@/shared/config/task-meta";
import type { TaskView, TaskStatus, TaskPriority } from "@/shared/types";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-muted) mb-2">
      {children}
    </p>
  );
}

// ─── EditableTitle ─────────────────────────────────────────────────────────────
function EditableTitle({ taskId, value }: { taskId: number; value: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateTaskTitle = useTaskStore((s) => s.updateTaskTitle);

  useEffect(() => { setDraft(value); }, [value]);

  const save = useCallback(() => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) updateTaskTitle(taskId, draft.trim());
    else setDraft(value);
  }, [draft, value, taskId, updateTaskTitle]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); inputRef.current?.blur(); }
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKey}
        className="w-full bg-[var(--glass-01)] border border-[var(--accent-500)] rounded-lg px-2 py-1 text-base font-semibold text-[var(--text-primary)] outline-none leading-snug"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Нажмите для редактирования"
      className="w-full text-left text-base font-semibold text-[var(--text-primary)] leading-snug hover:text-[var(--accent-400)] transition-colors group"
    >
      {value}
      <span className="ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity text-xs">✎</span>
    </button>
  );
}

// ─── EditableDescription ──────────────────────────────────────────────────────
function EditableDescription({ taskId, value }: { taskId: number; value: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateTaskDescription = useTaskStore((s) => s.updateTaskDescription);


  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  const save = useCallback(() => {
    setEditing(false);
    updateTaskDescription(taskId, draft);
  }, [draft, taskId, updateTaskDescription]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) textareaRef.current?.blur();
  };

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        rows={4}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKey}
        placeholder="Описание задачи..."
        className="w-full bg-[var(--glass-01)] border border-[var(--accent-500)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-(--text-muted) outline-none resize-none leading-relaxed"
      />
    );
  }

  if (value) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Нажмите для редактирования"
        className="w-full text-left text-sm text-[var(--text-secondary)] leading-relaxed hover:text-[var(--text-primary)] transition-colors group"
      >
        {value}
        <span className="ml-1 opacity-0 group-hover:opacity-60 transition-opacity text-xs">✎</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-[var(--text-secondary)] transition-colors px-2 py-1.5 rounded-lg border border-dashed border-[var(--glass-border)] w-full"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M7 2v10M2 7h10" />
      </svg>
      Добавить описание
    </button>
  );
}

// ─── DueDatePicker ────────────────────────────────────────────────────────────
function DueDatePicker({ taskId, value }: { taskId: number; value: string | null }) {
  const updateTaskDueDate = useTaskStore((s) => s.updateTaskDueDate);
  const inputVal = value ? value.slice(0, 10) : "";

  const now = new Date();
  const due = value ? new Date(value) : null;
  const isOverdue = due && due < now && due.toDateString() !== now.toDateString();
  const isToday = due && due.toDateString() === now.toDateString();

  const formatted = due
    ? due.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="date"
          value={inputVal}
          onChange={(e) => updateTaskDueDate(taskId, e.target.value ? new Date(e.target.value).toISOString() : null)}
          className={cn(
            "w-full bg-[var(--glass-01)] border rounded-lg px-3 py-2 text-sm outline-none transition-colors [color-scheme:dark]",
            "focus:border-[var(--accent-500)]",
            isOverdue ? "border-red-500/50" : isToday ? "border-amber-500/50" : "border-[var(--glass-border)]",
            !formatted ? "text-[var(--text-secondary)]" : "text-transparent",
          )}
        />
        {formatted && (
          <div className={cn(
            "absolute inset-0 flex items-center px-3 pointer-events-none text-sm gap-2",
            isOverdue ? "text-red-400" : isToday ? "text-amber-400" : "text-[var(--text-secondary)]"
          )}>
            <span>{formatted}</span>
            {isOverdue && <span className="text-xs text-red-500 font-semibold">просрочено</span>}
            {isToday && <span className="text-xs text-amber-500 font-semibold">сегодня</span>}
          </div>
        )}
        {!formatted && (
          <div className="absolute inset-0 flex items-center px-3 pointer-events-none text-sm text-(--text-muted)">
            Выберите дату...
          </div>
        )}
      </div>
      {value && (
        <button
          onClick={() => updateTaskDueDate(taskId, null)}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-(--text-muted) hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Убрать дедлайн"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── AssigneeManager ──────────────────────────────────────────────────────────
type UserOption = TaskView["assignees"][0];

function AssigneeManager({ taskId, assignees }: { taskId: number; assignees: UserOption[] }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addAssignee = useTaskStore((s) => s.addAssignee);
  const removeAssignee = useTaskStore((s) => s.removeAssignee);
  const assignedIds = new Set(assignees.map((a) => a.id));

  const fetchUsers = useCallback(async () => {
    if (users.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data ?? json ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [users.length]);

  const handleOpen = () => {
    setOpen(true);
    fetchUsers();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = users.filter((u) =>
    !assignedIds.has(u.id) &&
    (u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.roleMeta.label.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-2">
      {assignees.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl group"
          style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: a.roleMeta.hex }}
          >
            {a.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--text-primary)] truncate">{a.name}</p>
            <p className="text-xs text-(--text-muted) truncate">{a.roleMeta.label}</p>
          </div>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            style={{ backgroundColor: `${a.roleMeta.hex}22`, color: a.roleMeta.hex }}
          >
            {a.roleMeta.label}
          </span>
          <button
            onClick={() => removeAssignee(taskId, a.id)}
            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 text-(--text-muted) hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Убрать ответственного"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" />
            </svg>
          </button>
        </div>
      ))}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-(--text-muted) hover:text-[var(--text-secondary)] hover:bg-[var(--glass-01)] border border-dashed border-[var(--glass-border)] transition-all w-full"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M7 2v10M2 7h10" />
          </svg>
          Добавить ответственного
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full mb-1.5 left-0 right-0 z-10 rounded-xl overflow-hidden shadow-2xl"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)" }}
            >
              <div className="px-3 py-2 border-b border-[var(--glass-border)]">
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени или роли..."
                  className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-(--text-muted) outline-none"
                />
              </div>
              <div className="max-h-52 overflow-y-auto">
                {loading && (
                  <div className="px-3 py-4 text-center text-xs text-(--text-muted)">Загрузка...</div>
                )}
                {!loading && filtered.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-(--text-muted)">
                    {search ? "Не найдено" : "Все уже добавлены"}
                  </div>
                )}
                {filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { addAssignee(taskId, u); setOpen(false); setSearch(""); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--glass-01)] transition-colors text-left"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: u.roleMeta.hex }}
                    >
                      {u.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">{u.name}</p>
                      <p className="text-xs text-(--text-muted) truncate">{u.roleMeta.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── TaskSlideover ────────────────────────────────────────────────────────────
interface Props {
  task: TaskView | null;
  onClose: () => void;
}

export function TaskSlideover({ task, onClose }: Props) {
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
  const updateTaskPriority = useTaskStore((s) => s.updateTaskPriority);
  const liveTask = useTaskStore((s) => (task ? (s.getTask(task.id) ?? task) : null));

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {liveTask && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30"
            style={{ backdropFilter: "blur(4px)", background: "rgba(8,9,15,0.55)" }}
            onClick={onClose}
          />

          <motion.aside
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 h-screen z-40 flex flex-col overflow-hidden"
            style={{
              width: "min(520px, 100vw)",
              background: "var(--bg-surface)",
              borderLeft: "1px solid var(--glass-border)",
              boxShadow: "-24px 0 64px rgba(0,0,0,0.55)",
            }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-start gap-4 border-b shrink-0"
              style={{ borderColor: "var(--glass-border)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[var(--text-muted)] font-mono mb-1.5">#{liveTask.id}</p>
                <EditableTitle taskId={liveTask.id} value={liveTask.title} />
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-7 h-7 mt-1 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-02)] transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Description */}
              <div>
                <Label>Описание</Label>
                <EditableDescription
                  key={liveTask.id}
                  taskId={liveTask.id}
                  value={liveTask.description}
                />
              </div>

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Статус</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_ORDER.map((s) => {
                      const meta = STATUS_META[s as TaskStatus];
                      const active = liveTask.status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => updateTaskStatus(liveTask.id, s as TaskStatus)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150"
                          style={active
                            ? { backgroundColor: meta.bg, color: meta.color, boxShadow: `0 0 8px ${meta.color}30` }
                            : { backgroundColor: "var(--glass-01)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" }
                          }
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label>Приоритет</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORITY_ORDER.map((p) => {
                      const meta = PRIORITY_META[p as TaskPriority];
                      const active = liveTask.priority === p;
                      return (
                        <button
                          key={p}
                          onClick={() => updateTaskPriority(liveTask.id, p as TaskPriority)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150"
                          style={active
                            ? { backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, boxShadow: `0 0 8px ${meta.color}20` }
                            : { backgroundColor: "var(--glass-01)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" }
                          }
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Due date */}
              <div>
                <Label>Дедлайн</Label>
                <DueDatePicker taskId={liveTask.id} value={liveTask.dueDate} />
              </div>

              {/* Assignees */}
              <div>
                <Label>Ответственные</Label>
                <AssigneeManager taskId={liveTask.id} assignees={liveTask.assignees} />
              </div>

              {/* Subtasks */}
              <div>
                <SubtaskList taskId={liveTask.id} subtasks={liveTask.subtasks} />
              </div>

            </div>

            {/* Footer */}
            <div
              className="shrink-0 px-6 py-3 border-t flex items-center gap-3 text-xs text-(--text-muted)"
              style={{ borderColor: "var(--glass-border)" }}
            >
              <span>Создано {new Date(liveTask.createdAt).toLocaleDateString("ru-RU")}</span>
              {liveTask.updatedAt !== liveTask.createdAt && (
                <span>• Изменено {new Date(liveTask.updatedAt).toLocaleDateString("ru-RU")}</span>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}