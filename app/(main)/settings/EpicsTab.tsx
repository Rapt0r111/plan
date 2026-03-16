"use client";
/**
 * @file EpicsTab.tsx — app/(main)/settings
 *
 * РЕФАКТОРИНГ v2 — React 19 / Next.js 16:
 *
 * БЫЛО:
 *   fetch("/api/epics/...") напрямую из клиентского компонента.
 *   Ручной snapshot/rollback через useState.
 *
 * СТАЛО:
 *   useOptimistic   — мгновенный UI без ожидания сервера.
 *   useTransition   — обёртка для async Server Actions без блокировки UI.
 *   Server Actions  — updateEpicAction / deleteEpicAction / createEpicAction
 *                     из entities/epic/epicActions.ts.
 *
 * Rollback автоматический: если Server Action бросает исключение,
 * useOptimistic возвращает состояние к исходному.
 */
import { useState, useOptimistic, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { EpicWithTasks } from "@/shared/types";
import { formatDateInput, formatDateDisplay } from "@/shared/lib/utils";
import {
  createEpicAction,
  updateEpicAction,
  deleteEpicAction,
} from "@/entities/epic/epicActions";

interface Props {
  initialEpics: EpicWithTasks[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function deriveStatus(epic: EpicWithTasks): { label: string; color: string; bg: string } {
  const { total, done } = epic.progress;
  if (total > 0 && done === total) return { label: "Завершён",     color: "#34d399", bg: "rgba(52,211,153,0.12)"  };
  if (total > 0 && done > 0)       return { label: "В работе",     color: "#38bdf8", bg: "rgba(56,189,248,0.12)"  };
  if (epic.startDate && new Date(epic.startDate) <= new Date())
                                   return { label: "В работе",     color: "#38bdf8", bg: "rgba(56,189,248,0.12)"  };
  return                                  { label: "Планирование", color: "#94a3b8", bg: "rgba(100,116,139,0.12)" };
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────

function ProgressRing({ done, total, color }: { done: number; total: number; color: string }) {
  const R   = 14;
  const C   = 2 * Math.PI * R;
  const pct = total > 0 ? done / total : 0;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90 shrink-0">
      <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" />
      <circle cx="18" cy="18" r={R} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
        style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      <text x="18" y="18" textAnchor="middle" dominantBaseline="central"
        fontSize="7" fontFamily="DM Mono, monospace"
        fill={pct === 1 ? color : "rgba(255,255,255,0.5)"} transform="rotate(90 18 18)">
        {total > 0 ? `${Math.round(pct * 100)}%` : "0%"}
      </text>
    </svg>
  );
}

// ─── InlineText ───────────────────────────────────────────────────────────────

function InlineText({
  value, onSave, placeholder, mono = false, multiline = false,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);

  const save = () => {
    setEditing(false);
    const v = draft.trim();
    if (v !== value) onSave(v || value);
  };

  const inputCls = `w-full bg-[var(--glass-01)] border border-[var(--accent-500)] rounded-lg px-2 py-0.5 text-sm outline-none ${mono ? "font-mono" : ""}`;

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus value={draft} rows={3}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          className={inputCls + " resize-none"}
          style={{ color: "var(--text-primary)" }}
        />
      );
    }
    return (
      <input
        autoFocus value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className={inputCls}
        style={{ color: "var(--text-primary)" }}
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="group w-full text-left hover:opacity-80 transition-opacity flex items-start gap-1"
      style={{ color: value ? "var(--text-primary)" : "var(--text-muted)" }}
    >
      <span className={`text-sm ${mono ? "font-mono" : ""} ${multiline ? "line-clamp-2 leading-relaxed" : "truncate"}`}>
        {value || placeholder || "—"}
      </span>
      <span className="shrink-0 opacity-0 group-hover:opacity-40 text-xs mt-px">✎</span>
    </button>
  );
}

// ─── EpicCard ─────────────────────────────────────────────────────────────────

type EpicPatch = Partial<Pick<EpicWithTasks, "title" | "description" | "color" | "startDate" | "endDate">>;

function EpicCard({
  epic,
  onUpdate,
  onDelete,
  isPending,
}: {
  epic: EpicWithTasks;
  onUpdate: (patch: EpicPatch) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const status = deriveStatus(epic);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (epic.tasks.length > 0 && !confirmDelete) { setConfirmDelete(true); return; }
    onDelete();
    setConfirmDelete(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isPending ? 0.6 : 1, y: 0 }}
      className="rounded-xl overflow-hidden group"
      style={{
        background:  "var(--bg-elevated)",
        border:      "1px solid var(--glass-border)",
        borderLeft:  `3px solid ${epic.color}`,
      }}
    >
      <div
        className="px-4 pt-4 pb-3 space-y-3"
        style={{ background: `linear-gradient(135deg, ${epic.color}10 0%, transparent 55%)` }}
      >
        {/* Row 1: color + title + ring */}
        <div className="flex items-center gap-3">
          <input
            type="color" value={epic.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="w-7 h-7 rounded-lg cursor-pointer border-0 p-0.5 bg-transparent shrink-0"
            style={{ backgroundColor: `${epic.color}20` }}
            title="Цвет эпика"
          />
          <div className="flex-1 min-w-0">
            <InlineText
              value={epic.title}
              onSave={(v) => v && onUpdate({ title: v })}
              placeholder="Название эпика"
            />
          </div>
          <ProgressRing done={epic.progress.done} total={epic.progress.total} color={epic.color} />
        </div>

        {/* Row 2: description */}
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-1 font-semibold" style={{ color: "var(--text-muted)" }}>
            Описание
          </p>
          <InlineText
            value={epic.description ?? ""}
            onSave={(v) => onUpdate({ description: v || null })}
            placeholder="Добавить описание..."
            multiline
          />
        </div>

        {/* Row 3: dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
              Начало
            </label>
            <input
              type="date"
              value={formatDateInput(epic.startDate)}
              onChange={(e) => onUpdate({ startDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : null })}
              style={{ colorScheme: "dark", color: "var(--text-secondary)" }}
              className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[var(--accent-500)] transition-colors"
            />
            <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
              {formatDateDisplay(epic.startDate)}
            </p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
              Конец
            </label>
            <input
              type="date"
              value={formatDateInput(epic.endDate)}
              onChange={(e) => onUpdate({ endDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : null })}
              style={{ colorScheme: "dark" }}
              className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[var(--accent-500)] transition-colors"
            />
            <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
              {formatDateDisplay(epic.endDate)}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 flex items-center gap-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
          style={{ background: status.bg, color: status.color, borderColor: `${status.color}30` }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
          {status.label}
        </span>

        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          <span style={{ color: epic.color, fontWeight: 600 }}>{epic.progress.done}</span>
          /{epic.progress.total} задач
        </span>

        <div className="ml-auto flex items-center gap-2">
          <AnimatePresence>
            {confirmDelete && (
              <motion.div
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-2 text-xs" style={{ color: "#f87171" }}
              >
                <span>Удалить с {epic.tasks.length} задачами?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 rounded-lg text-xs transition-colors"
                  style={{ background: "var(--glass-02)", color: "var(--text-muted)" }}
                >
                  Нет
                </button>
                <button
                  onClick={onDelete}
                  className="px-2 py-0.5 rounded-lg text-xs transition-colors"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  Да
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleDelete}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)";   e.currentTarget.style.background = "transparent"; }}
            title="Удалить эпик"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── CreateEpicForm ────────────────────────────────────────────────────────────

function CreateEpicForm({
  onCreated,
  onCancel,
}: {
  onCreated: (epic: EpicWithTasks) => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: "", description: "", color: "#8b5cf6", startDate: "", endDate: "",
  });
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    if (!form.title.trim()) { setErr("Введите название"); return; }
    setErr(null);

    startTransition(async () => {
      try {
        const data = await createEpicAction({
          title:       form.title.trim(),
          description: form.description.trim() || null,
          color:       form.color,
          startDate:   form.startDate ? `${form.startDate}T00:00:00.000Z` : null,
          endDate:     form.endDate   ? `${form.endDate}T00:00:00.000Z`   : null,
        });
        const newEpic: EpicWithTasks = {
          ...data,
          tasks:    [],
          progress: { done: 0, total: 0 },
        };
        onCreated(newEpic);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка создания");
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 space-y-4"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--accent-500)" }}
    >
      {err && <p className="text-xs text-red-400">{err}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-(--text-muted) block mb-1">Название *</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Название эпика"
            className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-(--text-muted) outline-none focus:border-[var(--accent-500)] transition-colors"
          />
        </div>

        <div className="col-span-2">
          <label className="text-xs text-(--text-muted) block mb-1">Описание</label>
          <textarea
            value={form.description} rows={2}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Краткое описание эпика..."
            className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-(--text-muted) outline-none focus:border-[var(--accent-500)] transition-colors resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-(--text-muted) block mb-1">Цвет</label>
          <div className="flex items-center gap-2">
            <input
              type="color" value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="w-8 h-8 rounded-lg cursor-pointer border-0"
              style={{ backgroundColor: `${form.color}20` }}
            />
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{form.color}</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-(--text-muted) block mb-1">Дата начала</label>
          <input
            type="date" value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            style={{ colorScheme: "dark" }}
            className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-500)] transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-(--text-muted) block mb-1">Дата окончания</label>
          <input
            type="date" value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            style={{ colorScheme: "dark" }}
            className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-500)] transition-colors"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={submit} disabled={isPending}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: "var(--accent-glow)", color: "var(--accent-400)",
            border: "1px solid rgba(139,92,246,0.3)", opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Создание..." : "Создать"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-(--text-muted) transition-all"
          style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}
        >
          Отмена
        </button>
      </div>
    </motion.div>
  );
}

// ─── EpicsTab ─────────────────────────────────────────────────────────────────

export function EpicsTab({ initialEpics }: Props) {
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating]       = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // useOptimistic:
  //   - первый аргумент: реальное состояние (обновляется сервером через revalidateTag)
  //   - второй аргумент: функция применения оптимистичного обновления
  //   Если Server Action бросает исключение — состояние автоматически откатывается.
  const [optimisticEpics, applyOptimistic] = useOptimistic(
    initialEpics,
    (state: EpicWithTasks[], action:
      | { type: "update"; id: number; patch: EpicPatch }
      | { type: "delete"; id: number }
      | { type: "create"; epic: EpicWithTasks }
    ) => {
      if (action.type === "update") {
        return state.map((e) => e.id === action.id ? { ...e, ...action.patch } : e);
      }
      if (action.type === "delete") {
        return state.filter((e) => e.id !== action.id);
      }
      if (action.type === "create") {
        return [...state, action.epic];
      }
      return state;
    },
  );

  const handleUpdate = (epic: EpicWithTasks, patch: EpicPatch) => {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ type: "update", id: epic.id, patch });
      try {
        await updateEpicAction(epic.id, patch);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка обновления");
      }
    });
  };

  const handleDelete = (epic: EpicWithTasks) => {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: epic.id });
      try {
        await deleteEpicAction(epic.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка удаления");
      }
    });
  };

  const handleCreated = (epic: EpicWithTasks) => {
    startTransition(() => {
      applyOptimistic({ type: "create", epic });
    });
    setCreating(false);
  };

  const totalTasks = optimisticEpics.reduce((s, e) => s + e.progress.total, 0);
  const doneTasks  = optimisticEpics.reduce((s, e) => s + e.progress.done,  0);

  return (
    <div className="max-w-3xl space-y-4">

      {/* Stats row */}
      <div
        className="flex items-center gap-6 px-4 py-3 rounded-xl"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
      >
        <div>
          <p className="text-xs text-(--text-muted)">Эпиков</p>
          <p className="text-xl font-bold font-mono" style={{ color: "var(--accent-400)" }}>
            {optimisticEpics.length}
          </p>
        </div>
        <div className="w-px h-8 bg-[var(--glass-border)]" />
        <div>
          <p className="text-xs text-(--text-muted)">Задач всего</p>
          <p className="text-xl font-bold font-mono" style={{ color: "#38bdf8" }}>{totalTasks}</p>
        </div>
        <div className="w-px h-8 bg-[var(--glass-border)]" />
        <div>
          <p className="text-xs text-(--text-muted)">Выполнено</p>
          <p className="text-xl font-bold font-mono" style={{ color: "#34d399" }}>{doneTasks}</p>
        </div>
        {totalTasks > 0 && (
          <>
            <div className="w-px h-8 bg-[var(--glass-border)]" />
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <p className="text-xs text-(--text-muted)">Общий прогресс</p>
                <p className="text-xs font-mono font-semibold" style={{ color: "var(--accent-400)" }}>
                  {Math.round((doneTasks / totalTasks) * 100)}%
                </p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-02)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.round((doneTasks / totalTasks) * 100)}%`,
                    background: "linear-gradient(90deg, var(--accent-500), var(--accent-400))",
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="px-4 py-3 rounded-xl text-sm flex items-center gap-3"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
          >
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Epic cards */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {optimisticEpics.map((epic) => (
            <EpicCard
              key={epic.id}
              epic={epic}
              isPending={isPending}
              onUpdate={(patch) => handleUpdate(epic, patch)}
              onDelete={() => handleDelete(epic)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Create button / form */}
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full"
          style={{ border: "1px dashed var(--glass-border)", color: "var(--text-muted)" }}
        >
          <span className="text-lg leading-none">+</span>
          Добавить эпик
        </button>
      ) : (
        <CreateEpicForm
          onCreated={handleCreated}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  );
}