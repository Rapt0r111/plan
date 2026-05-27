"use client";

import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SelectField } from "@/shared/ui/SelectField";
import type {
  DbPersonalPlanCompletion,
  DbPersonalPlanItem,
  PersonalPlanData,
  PersonalPlanUserBlock,
} from "@/entities/personal-plan/personalPlanRepository";
import {
  getPersonalPlanDenseDayMaxHeight,
  getPersonalPlanItemState,
  PERSONAL_PLAN_DENSE_DAY_ITEM_CAPACITY,
  PERSONAL_PLAN_WEEK_COLUMN_TEMPLATE,
  type PersonalPlanWeekDate,
} from "@/shared/lib/personal-plan";

interface Props {
  data: PersonalPlanData;
  isAdmin: boolean;
}

interface SelectedTask {
  block: PersonalPlanUserBlock;
  day: PersonalPlanWeekDate;
  item: DbPersonalPlanItem;
}

const PLAN_COLORS = ["#8b5cf6", "#38bdf8", "#34d399", "#f59e0b", "#ef4444", "#ec4899"];
const DENSE_DAY_MAX_HEIGHT = getPersonalPlanDenseDayMaxHeight();

// Static style constants — defined once, never recreated
const SURFACE_BORDER = "1px solid var(--glass-border)";
const PANEL_SHADOW = "0 18px 48px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.04)";
const BLUE_ACCENT = "#2563eb";

const CHIP_BASE: CSSProperties = { background: "var(--glass-01)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" };

const statusMeta = {
  completed: { label: "Готово", color: "#34d399", bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.28)" },
  overdue:   { label: "Просрочено", color: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.42)" },
  current:   { label: "Сейчас", color: "#38bdf8", bg: "rgba(56,189,248,0.10)", border: "rgba(56,189,248,0.32)" },
  upcoming:  { label: "План", color: "#94a3b8", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.20)" },
} as const;

// CSS for animations injected once — avoids JS-driven infinite loops
const ANIMATION_STYLES = `
  @keyframes ppPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.45; }
  }
  @keyframes ppOverduePulse {
    0%, 100% { opacity: 0.13; }
    50%       { opacity: 0.03; }
  }
  @keyframes ppProgressFill {
    from { width: 0; }
  }
  .pp-pulse            { animation: ppPulse 1.4s ease-in-out infinite; }
  .pp-overdue-overlay  { animation: ppOverduePulse 1.4s ease-in-out infinite; }
  .pp-progress-fill    { animation: ppProgressFill 0.45s ease-out both; }
  .pp-card-appear      { animation: ppCardAppear 0.22s ease-out both; }
  @keyframes ppCardAppear {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pp-pulse,
    .pp-overdue-overlay,
    .pp-progress-fill,
    .pp-card-appear {
      animation: none !important;
    }
    .pp-motion-safe {
      transition: none !important;
    }
  }
`;

function useTimeLabel() {
  const [label, setLabel] = useState(() =>
    new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  );
  useEffect(() => {
    const id = setInterval(
      () => setLabel(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })),
      30_000
    );
    return () => clearInterval(id);
  }, []);
  return label;
}

export function PersonalPlanBoard({ data, isAdmin }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | "all">("all");
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);
  const [collapsedUserIds, setCollapsedUserIds] = useState<Set<number>>(() => new Set());

  const visibleBlocks = useMemo(
    () =>
      selectedUserId === "all"
        ? data.users
        : data.users.filter((block) => block.user.id === selectedUserId),
    [data.users, selectedUserId],
  );

  const summary = useMemo(() => {
    const allItems = data.users.flatMap((block) => block.items);
    const states = allItems.map((item) => getPersonalPlanItemState(item, data.completions));
    const completed = states.filter((s) => s.isCompleted).length;
    return {
      total: allItems.length,
      completed,
      overdue: states.filter((s) => s.isOverdue).length,
      current: states.filter((s) => s.isCurrent).length,
      progress: allItems.length ? Math.round((completed / allItems.length) * 100) : 0,
    };
  }, [data]);

  const weekRange = useMemo(() => {
    const first = data.weekDates[0]?.isoDate.slice(5);
    const last = data.weekDates.at(-1)?.isoDate.slice(5);
    return first && last ? `${first}–${last}` : "текущая неделя";
  }, [data.weekDates]);

  const mutate = useCallback(async (url: string, init: RequestInit, busy?: number) => {
    setBusyId(busy ?? null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
      if (!res.ok) throw new Error(await res.text());
      startTransition(() => router.refresh());
      return true;
    } finally {
      setBusyId(null);
    }
  }, [router, startTransition]);

  const handleAdd = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = formPayload(new FormData(event.currentTarget));
    const ok = await mutate("/api/personal-plan", { method: "POST", body: JSON.stringify(payload) });
    if (ok) {
      event.currentTarget.reset();
      setAdding(false);
    }
  }, [mutate]);

  const handleEdit = useCallback(async (event: FormEvent<HTMLFormElement>, itemId: number) => {
    event.preventDefault();
    const payload = formPayload(new FormData(event.currentTarget));
    const ok = await mutate(`/api/personal-plan/${itemId}`, { method: "PATCH", body: JSON.stringify(payload) }, itemId);
    if (ok) {
      setEditingTaskId(null);
      setSelectedTask(null);
    }
  }, [mutate]);

  const toggleCompletion = useCallback(
    (item: DbPersonalPlanItem, completions: DbPersonalPlanCompletion[]) => {
      const state = getPersonalPlanItemState(item, completions);
      return mutate(
        `/api/personal-plan/${item.id}/completion`,
        { method: "PATCH", body: JSON.stringify({ date: state.occurrenceDate, completed: !state.isCompleted }) },
        item.id,
      );
    },
    [mutate],
  );

  const deleteItem = useCallback(async (itemId: number) => {
    if (!window.confirm("Удалить задачу из повторяющегося личного плана?")) return;
    const ok = await mutate(`/api/personal-plan/${itemId}`, { method: "DELETE" }, itemId);
    if (ok) setSelectedTask((cur) => (cur?.item.id === itemId ? null : cur));
  }, [mutate]);

  const toggleUserPlan = useCallback((userId: number) => {
    setCollapsedUserIds((cur) => {
      const next = new Set(cur);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleOpenDetails = useCallback((task: SelectedTask) => {
    setEditingTaskId(null);
    setSelectedTask(task);
  }, []);

  const handleEditStart = useCallback((task: SelectedTask) => {
    setSelectedTask(task);
    setEditingTaskId(task.item.id);
  }, []);

  const handleEditStartById = useCallback((id: number) => setEditingTaskId(id), []);
  const handleEditCancel = useCallback(() => setEditingTaskId(null), []);
  const handleClose = useCallback(() => {
    setEditingTaskId(null);
    setSelectedTask(null);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Inject CSS animations once */}
      <style>{ANIMATION_STYLES}</style>

      <main className="p-3 lg:p-4 space-y-3" aria-label="Личный план недели">
        {/* Header card */}
        <section
          className="relative overflow-hidden rounded-[26px] px-3.5 py-3.5 lg:px-4"
          style={{
            background:
              "radial-gradient(circle at 12% 8%, rgba(37,99,235,0.20), transparent 30%), radial-gradient(circle at 88% 12%, rgba(56,189,248,0.16), transparent 28%), linear-gradient(135deg, rgba(15,23,42,0.88), rgba(2,6,23,0.18))",
            border: SURFACE_BORDER,
            boxShadow: PANEL_SHADOW,
          }}
        >
          <div className="absolute -right-16 -top-28 h-56 w-56 rounded-full bg-[rgba(37,99,235,0.13)] blur-3xl pointer-events-none" />
          <div className="absolute -left-24 bottom-0 h-44 w-44 rounded-full bg-[rgba(52,211,153,0.06)] blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
          <div className="relative grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ background: "rgba(37,99,235,0.14)", color: "#93c5fd", border: "1px solid rgba(147,197,253,0.18)" }}>
                  Оперативная неделя
                </p>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-mono text-(--text-muted)" style={{ border: SURFACE_BORDER }}>
                  {weekRange}
                </span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-(--text-primary) lg:text-2xl">
                Личный план: плотный недельный пульт
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-(--text-secondary)">
                Фокус на том, что нужно выполнить сегодня: сотрудники, статусы, просрочки и быстрые отметки в одной компактной сетке.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:justify-end">
              <Metric label="Всего" value={summary.total} color="#a78bfa" />
              <Metric label="Готово" value={summary.completed} color="#34d399" />
              <Metric label="Сейчас" value={summary.current} color="#38bdf8" />
              <Metric label="Проср." value={summary.overdue} color="#f87171" pulse={summary.overdue > 0} />
            </div>

            <div className="xl:col-span-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <ProgressRail value={summary.progress} />
              <StatusLegend />
            </div>
          </div>
        </section>

        {/* Focus filter */}
        <FocusBar
          users={data.users}
          selectedUserId={selectedUserId}
          onSelect={setSelectedUserId}
        />

        {/* Admin add panel */}
        {isAdmin && data.users.length > 0 && (
          <section
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.08), transparent 36%), var(--bg-elevated)",
              border: SURFACE_BORDER,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="cursor-pointer w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left transition-colors hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: `linear-gradient(135deg, ${BLUE_ACCENT}, #38bdf8)`, boxShadow: "0 12px 28px rgba(37,99,235,0.22)" }}
                >
                  <PlusIcon />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-(--text-primary)">Новая повторяющаяся задача</span>
                  <span className="block truncate text-[11px] text-(--text-muted)">Добавление сразу попадает в недельную сетку сотрудника</span>
                </span>
              </span>
              <span className="rounded-lg px-2 py-1 text-[11px] font-mono text-(--text-muted)" style={{ border: SURFACE_BORDER }}>
                {adding ? "закрыть" : "admin"}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {adding && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="p-3 pt-0">
                    <PlanItemForm users={data.users} weekDates={data.weekDates} onSubmit={handleAdd} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* User blocks */}
        {visibleBlocks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {visibleBlocks.map((block, idx) => (
              <UserPlanSection
                key={block.user.id}
                block={block}
                idx={idx}
                data={data}
                isAdmin={isAdmin}
                busyId={busyId}
                isCollapsed={collapsedUserIds.has(block.user.id)}
                onToggleCollapse={toggleUserPlan}
                onDetails={handleOpenDetails}
                onEditStart={handleEditStart}
                onDelete={deleteItem}
                onToggle={toggleCompletion}
              />
            ))}
          </div>
        )}

        <TaskDetailsDialog
          selectedTask={selectedTask}
          users={data.users}
          weekDates={data.weekDates}
          completions={data.completions}
          isEditing={selectedTask ? editingTaskId === selectedTask.item.id : false}
          isAdmin={isAdmin}
          busyId={busyId}
          onClose={handleClose}
          onToggle={toggleCompletion}
          onEditStart={handleEditStartById}
          onEditCancel={handleEditCancel}
          onEdit={handleEdit}
          onDelete={deleteItem}
        />

        {(isPending || busyId !== null) && (
          <div
            className="fixed bottom-5 right-5 px-3 py-2 rounded-xl text-xs font-semibold shadow-2xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
          >
            Сохраняю изменения…
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Extracted & memoised sub-components ──────────────────────────────────────

const FocusBar = memo(function FocusBar({
  users,
  selectedUserId,
  onSelect,
}: {
  users: PersonalPlanUserBlock[];
  selectedUserId: number | "all";
  onSelect: (id: number | "all") => void;
}) {
  const timeLabel = useTimeLabel();
  return (
    <section className="rounded-2xl px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))", border: SURFACE_BORDER }}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-(--text-muted)">Фокус</span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => onSelect("all")}
            className="cursor-pointer shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors hover:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
            style={selectedUserId === "all" ? chipStyle(true) : CHIP_BASE}
          >
            Все планы · {users.length}
          </button>
          {users.map((block) => (
            <button
              type="button"
              key={block.user.id}
              onClick={() => onSelect(block.user.id)}
              className="cursor-pointer shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors hover:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
              style={selectedUserId === block.user.id ? chipStyle(true, block.user.roleMeta.hex) : CHIP_BASE}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: block.user.roleMeta.hex }} />
              {block.user.name}
            </button>
          ))}
        </div>
        <span className="ml-auto hidden shrink-0 rounded-lg px-2 py-1 text-[11px] font-mono text-(--text-muted) sm:inline" style={{ border: SURFACE_BORDER }}>
          сейчас {timeLabel}
        </span>
      </div>
    </section>
  );
});

// Memoised per-user section — only re-renders when its own props change
const UserPlanSection = memo(function UserPlanSection({
  block,
  idx,
  data,
  isAdmin,
  busyId,
  isCollapsed,
  onToggleCollapse,
  onDetails,
  onEditStart,
  onDelete,
  onToggle,
}: {
  block: PersonalPlanUserBlock;
  idx: number;
  data: PersonalPlanData;
  isAdmin: boolean;
  busyId: number | null;
  isCollapsed: boolean;
  onToggleCollapse: (id: number) => void;
  onDetails: (task: SelectedTask) => void;
  onEditStart: (task: SelectedTask) => void;
  onDelete: (id: number) => void;
  onToggle: (item: DbPersonalPlanItem, completions: DbPersonalPlanCompletion[]) => void;
}) {
  const panelId = `personal-plan-user-${block.user.id}-week`;
  const handleToggle = useCallback(() => onToggleCollapse(block.user.id), [block.user.id, onToggleCollapse]);

  return (
    <section
      data-testid="personal-plan-user-week"
      className="rounded-[24px] overflow-hidden pp-card-appear"
      style={{
        background: `linear-gradient(135deg, ${block.user.roleMeta.hex}12, transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.028), transparent 22%), var(--bg-elevated)`,
        border: SURFACE_BORDER,
        boxShadow: PANEL_SHADOW,
        animationDelay: `${idx * 25}ms`,
      }}
    >
      <UserPlanHeader
        block={block}
        completions={data.completions}
        isCollapsed={isCollapsed}
        panelId={panelId}
        onToggle={handleToggle}
      />
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="overflow-x-auto">
              <div
                data-testid="personal-plan-week-grid"
                className="grid min-w-[980px] gap-1.5 p-2 lg:min-w-0"
                style={{ gridTemplateColumns: PERSONAL_PLAN_WEEK_COLUMN_TEMPLATE }}
              >
                {data.weekDates.map((day) => (
                  <DayColumn
                    key={`${block.user.id}-${day.isoDate}`}
                    block={block}
                    day={day}
                    completions={data.completions}
                    isAdmin={isAdmin}
                    busyId={busyId}
                    onDetails={onDetails}
                    onEditStart={onEditStart}
                    onDelete={onDelete}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formPayload(form: FormData) {
  return {
    userId: Number(form.get("userId")),
    weekday: Number(form.get("weekday")),
    title: String(form.get("title") ?? ""),
    description: String(form.get("description") ?? "") || null,
    startTime: String(form.get("startTime") ?? "09:00"),
    endTime: String(form.get("endTime") ?? "10:00"),
    color: String(form.get("color") ?? "#8b5cf6"),
  };
}

// ─── useAnimatedNumber ────────────────────────────────────────────────────────
// Smoothly interpolates a number using requestAnimationFrame + ease-out curve.
// Zero dependencies, zero JS overhead when value is stable.

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function useAnimatedNumber(target: number, duration = 520): number {
  const [displayed, setDisplayed] = useState(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(target);

  useEffect(() => {
    // Nothing to animate
    if (fromRef.current === target) return;

    const from = fromRef.current;
    fromRef.current = target;

    // Cancel any in-flight animation
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    function tick(now: number) {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = Math.round(from + (target - from) * eased);
      setDisplayed(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return displayed;
}

// ─── Metric ───────────────────────────────────────────────────────────────────

const metricBase: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const Metric = memo(function Metric({
  label,
  value,
  color,
  pulse = false,
}: {
  label: string;
  value: number;
  color: string;
  pulse?: boolean;
}) {
  const animated = useAnimatedNumber(value);
  return (
    <div className="min-w-20 rounded-2xl px-2.5 py-2" style={metricBase}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        <p className="text-[9px] uppercase tracking-wider text-(--text-muted)">{label}</p>
      </div>
      <p className={`text-base font-semibold font-mono leading-tight${pulse ? " pp-pulse" : ""}`} style={{ color }}>
        {animated}
      </p>
    </div>
  );
});

// ─── ProgressRail ─────────────────────────────────────────────────────────────

function ProgressRail({ value }: { value: number }) {
  const animated = useAnimatedNumber(value, 480);
  return (
    <div className="rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-(--text-muted)">Прогресс недели</span>
        <span className="text-[10px] font-mono tabular-nums text-(--text-secondary)" aria-label={`Выполнено ${value}%`}>
          {animated}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.07)" }}
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${animated}%`,
            background: "linear-gradient(90deg, #8b5cf6, #38bdf8, #34d399)",
            transition: "width 0.48s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl px-2.5 py-2" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {Object.values(statusMeta).map((meta) => (
        <span key={meta.label} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold text-(--text-secondary)" style={{ border: `1px solid ${meta.border}`, background: meta.bg }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
          {meta.label}
        </span>
      ))}
    </div>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────

const pillNeutral: CSSProperties = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.075)",
  color: "var(--text-muted)",
};
const pillDanger: CSSProperties = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.26)",
  color: "#fca5a5",
};
const pillInfo: CSSProperties = {
  background: "rgba(56,189,248,0.10)",
  border: "1px solid rgba(56,189,248,0.24)",
  color: "#7dd3fc",
};

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "danger" | "info" }) {
  const style = tone === "danger" ? pillDanger : tone === "info" ? pillInfo : pillNeutral;
  return (
    <span className="rounded-lg px-2 py-1 text-[11px] font-mono" style={style}>
      {label}
    </span>
  );
}

// ─── PlanItemForm ─────────────────────────────────────────────────────────────

function PlanItemForm({
  users,
  weekDates,
  item,
  onSubmit,
}: {
  users: PersonalPlanUserBlock[];
  weekDates: PersonalPlanWeekDate[];
  item?: DbPersonalPlanItem;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const userOptions = useMemo(
    () => users.map((b) => ({ value: b.user.id, label: b.user.name, description: b.user.roleMeta.label, color: b.user.roleMeta.hex })),
    [users],
  );
  const weekdayOptions = useMemo(
    () => weekDates.map((d) => ({ value: d.weekday, label: d.label, description: d.isoDate.slice(5), color: d.isToday ? "#a78bfa" : "#64748b" })),
    [weekDates],
  );
  const colorOptions = useMemo(
    () => PLAN_COLORS.map((c) => ({ value: c, label: c.toUpperCase(), color: c })),
    [],
  );

  const submitBtnStyle: CSSProperties = {
    background: "linear-gradient(135deg, rgba(139,92,246,0.28), rgba(56,189,248,0.14))",
    color: "var(--accent-300)",
    border: "1px solid rgba(139,92,246,0.34)",
    boxShadow: "0 10px 28px rgba(139,92,246,0.12)",
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[1.15fr_0.9fr_1fr_0.55fr_0.55fr_0.6fr_auto]">
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Сотрудник</span>
        <SelectField name="userId" defaultValue={item?.userId ?? users[0]?.user.id} options={userOptions} compact />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-widest text-(--text-muted)">День</span>
        <SelectField name="weekday" defaultValue={item?.weekday ?? 1} options={weekdayOptions} compact />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Название</span>
        <input name="title" required maxLength={200} defaultValue={item?.title} className="form-field" placeholder="Планёрка" />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-widest text-(--text-muted)">С</span>
        <input name="startTime" type="time" required defaultValue={item?.startTime ?? "09:00"} className="form-field" />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-widest text-(--text-muted)">До</span>
        <input name="endTime" type="time" required defaultValue={item?.endTime ?? "10:00"} className="form-field" />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Цвет</span>
        <SelectField name="color" defaultValue={item?.color ?? PLAN_COLORS[0]} options={colorOptions} compact />
      </label>
      <label className="grid gap-1 md:col-span-2 xl:col-span-6">
        <span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Описание</span>
        <input name="description" maxLength={2000} defaultValue={item?.description ?? ""} className="form-field" placeholder="Комментарий или критерий выполнения" />
      </label>
      <button
        type="submit"
        className="cursor-pointer self-end px-4 py-2 rounded-xl text-xs font-semibold transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        style={submitBtnStyle}
      >
        Сохранить
      </button>
    </form>
  );
}

// ─── UserPlanHeader ───────────────────────────────────────────────────────────

const UserPlanHeader = memo(function UserPlanHeader({
  block,
  completions,
  isCollapsed,
  panelId,
  onToggle,
}: {
  block: PersonalPlanUserBlock;
  completions: DbPersonalPlanCompletion[];
  isCollapsed: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const states = useMemo(
    () => block.items.map((item) => getPersonalPlanItemState(item, completions)),
    [block.items, completions],
  );
  const done = states.filter((s) => s.isCompleted).length;
  const overdue = states.filter((s) => s.isOverdue).length;
  const current = states.filter((s) => s.isCurrent).length;
  const pct = block.items.length ? Math.round((done / block.items.length) * 100) : 0;
  const animatedPct = useAnimatedNumber(pct, 480);
  const animatedDone = useAnimatedNumber(done, 480);

  const headerStyle: CSSProperties = useMemo(
    () => ({
      borderBottom: SURFACE_BORDER,
      background: `linear-gradient(120deg, ${block.user.roleMeta.hex}14, transparent 58%)`,
    }),
    [block.user.roleMeta.hex],
  );

  const avatarStyle: CSSProperties = useMemo(
    () => ({
      background: block.user.roleMeta.hex,
      boxShadow: `0 0 18px ${block.user.roleMeta.hex}45`,
    }),
    [block.user.roleMeta.hex],
  );

  const progressFillStyle: CSSProperties = useMemo(
    () => ({
      background: block.user.roleMeta.hex,
      width: `${animatedPct}%`,
      transition: "width 0.48s cubic-bezier(0.16, 1, 0.3, 1)",
    }),
    [block.user.roleMeta.hex, animatedPct],
  );

  return (
    <div className="px-3 py-2.5 flex items-center gap-2.5" style={headerStyle}>
      <div className="h-10 w-10 rounded-2xl flex items-center justify-center text-xs font-bold text-white shrink-0" style={avatarStyle}>
        {block.user.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-sm font-semibold leading-tight truncate text-(--text-primary)">{block.user.name}</h3>
          {current > 0 && <StatusPill label={`${current} сейчас`} tone="info" />}
        </div>
        <p className="mt-0.5 text-[11px] truncate text-(--text-muted)">{block.user.roleMeta.short} · {block.user.roleMeta.label}</p>
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">
        <StatusPill label={`${block.items.length} задач`} />
        {overdue > 0 && <StatusPill label={`${overdue} просрочено`} tone="danger" />}
      </div>
      <div className="w-28">
        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
          <span style={{ color: block.user.roleMeta.hex }}>{animatedPct}%</span>
          <span className="text-(--text-muted)">{animatedDone}/{block.items.length}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={progressFillStyle} />
        </div>
      </div>
      <button
        type="button"
        aria-controls={panelId}
        aria-expanded={!isCollapsed}
        onClick={onToggle}
        className="cursor-pointer flex h-8 min-w-8 items-center justify-center rounded-xl text-[11px] font-semibold text-(--text-muted) transition-colors hover:bg-white/[0.045] hover:text-(--text-primary) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        style={{ border: SURFACE_BORDER }}
        title={isCollapsed ? "Развернуть план" : "Свернуть план"}
      >
        <span className="inline-block transition-transform duration-150 pp-motion-safe" style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
          <ChevronDownIcon />
        </span>
      </button>
    </div>
  );
});

// ─── DayColumn ────────────────────────────────────────────────────────────────

const DayColumn = memo(function DayColumn({
  block,
  day,
  completions,
  isAdmin,
  busyId,
  onDetails,
  onEditStart,
  onDelete,
  onToggle,
}: {
  block: PersonalPlanUserBlock;
  day: PersonalPlanWeekDate;
  completions: DbPersonalPlanCompletion[];
  isAdmin: boolean;
  busyId: number | null;
  onDetails: (task: SelectedTask) => void;
  onEditStart: (task: SelectedTask) => void;
  onDelete: (itemId: number) => void;
  onToggle: (item: DbPersonalPlanItem, completions: DbPersonalPlanCompletion[]) => void;
}) {
  const items = useMemo(
    () => block.items.filter((item) => item.weekday === day.weekday),
    [block.items, day.weekday],
  );
  const overdue = useMemo(
    () => items.filter((item) => getPersonalPlanItemState(item, completions).isOverdue).length,
    [items, completions],
  );
  const hasOverflow = items.length > PERSONAL_PLAN_DENSE_DAY_ITEM_CAPACITY;

  const colStyle: CSSProperties = useMemo(
    () => ({
      background: day.isToday
        ? "linear-gradient(180deg, rgba(37,99,235,0.13), rgba(37,99,235,0.035))"
        : "rgba(255,255,255,0.018)",
      border: day.isToday ? "1px solid rgba(96,165,250,0.38)" : SURFACE_BORDER,
      boxShadow: day.isToday ? "0 0 0 1px rgba(96,165,250,0.08), 0 12px 28px rgba(37,99,235,0.10)" : "none",
    }),
    [day.isToday],
  );

  return (
    <div className="min-w-0 rounded-2xl overflow-hidden transition-colors" style={colStyle}>
      <div className="px-2 py-1.5 flex items-center justify-between gap-1" style={{ borderBottom: SURFACE_BORDER }}>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-tight text-(--text-primary)">{day.shortLabel}</p>
          <p className="text-[9px] font-mono leading-tight text-(--text-muted)">{day.isoDate.slice(5)}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <span className="rounded-md px-1.5 py-0.5 text-(--text-muted)" style={{ border: "1px solid var(--glass-border)", background: "var(--glass-01)" }} title="Задач в день">
            {items.length}
          </span>
          {day.isToday && (
            <span className="rounded-md px-1.5 py-0.5 font-semibold text-sky-300" style={{ background: "rgba(37,99,235,0.18)" }}>
              сегодня
            </span>
          )}
          {overdue > 0 && (
            <span
              className="rounded-md px-1.5 py-0.5 font-bold text-red-300"
              style={{ background: "rgba(239,68,68,0.14)" }}
              title="Просрочено"
            >
              {overdue}
            </span>
          )}
        </div>
      </div>
      <div
        className="p-1.5 flex flex-col gap-1 overscroll-contain"
        style={{ maxHeight: `${DENSE_DAY_MAX_HEIGHT}px`, overflowY: hasOverflow ? "auto" : "hidden" }}
      >
        {items.length === 0 ? (
          <div
            className="h-7 rounded-xl flex items-center justify-center text-[11px] text-(--text-muted)"
            style={{ border: "1px dashed var(--glass-border)" }}
          >
            свободно
          </div>
        ) : (
          items.map((item) => (
            <PersonalPlanItemRow
              key={item.id}
              block={block}
              item={item}
              day={day}
              completions={completions}
              isAdmin={isAdmin}
              busyId={busyId}
              onDetails={onDetails}
              onEditStart={onEditStart}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))
        )}
      </div>
    </div>
  );
});

// ─── PersonalPlanItemRow ──────────────────────────────────────────────────────

const PersonalPlanItemRow = memo(function PersonalPlanItemRow({
  block,
  item,
  day,
  completions,
  isAdmin,
  busyId,
  onDetails,
  onEditStart,
  onDelete,
  onToggle,
}: {
  block: PersonalPlanUserBlock;
  item: DbPersonalPlanItem;
  day: PersonalPlanWeekDate;
  completions: DbPersonalPlanCompletion[];
  isAdmin: boolean;
  busyId: number | null;
  onDetails: (task: SelectedTask) => void;
  onEditStart: (task: SelectedTask) => void;
  onDelete: (itemId: number) => void;
  onToggle: (item: DbPersonalPlanItem, completions: DbPersonalPlanCompletion[]) => void;
}) {
  const state = useMemo(() => getPersonalPlanItemState(item, completions), [item, completions]);
  const meta = statusMeta[state.status];

  const handleToggle = useCallback(() => onToggle(item, completions), [item, completions, onToggle]);
  const handleDetails = useCallback(() => onDetails({ block, day, item }), [block, day, item, onDetails]);
  const handleEditStart = useCallback(() => onEditStart({ block, day, item }), [block, day, item, onEditStart]);
  const handleDelete = useCallback(() => onDelete(item.id), [item.id, onDelete]);

  const articleStyle: CSSProperties = useMemo(
    () => ({
      background: state.isCompleted ? "rgba(52,211,153,0.055)" : meta.bg,
      border: `1px solid ${state.isOverdue ? meta.border : "var(--glass-border)"}`,
      boxShadow: state.isOverdue
        ? "0 0 14px rgba(239,68,68,0.12)"
        : state.isCurrent
        ? "0 0 12px rgba(56,189,248,0.11)"
        : "none",
    }),
    [state.isCompleted, state.isOverdue, state.isCurrent, meta.bg, meta.border],
  );

  const checkBtnStyle: CSSProperties = useMemo(
    () => ({
      background: state.isCompleted ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${state.isCompleted ? "rgba(52,211,153,0.4)" : "var(--glass-border)"}`,
      color: state.isCompleted ? "#34d399" : "var(--text-muted)",
    }),
    [state.isCompleted],
  );

  return (
    <article
      className="group relative min-h-[50px] rounded-xl overflow-hidden transition-colors hover:bg-white/[0.04]"
      style={articleStyle}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: item.color }} />
      {/* CSS-driven overdue pulse — no JS animation loop */}
      {state.isOverdue && (
        <div
          className="absolute inset-0 pointer-events-none pp-overdue-overlay"
          style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.20), transparent)" }}
        />
      )}
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-1.5 py-1.5 pl-2 pr-1.5">
        <button
          type="button"
          disabled={busyId === item.id}
          onClick={handleToggle}
          aria-pressed={state.isCompleted}
          aria-label={state.isCompleted ? "Снять отметку выполнения" : "Отметить задачу выполненной"}
          className="cursor-pointer mt-0.5 h-5 w-5 rounded-lg shrink-0 flex items-center justify-center text-[10px] leading-none transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          style={checkBtnStyle}
          title="Отметить выполнение"
        >
          {state.isCompleted && <CheckIcon />}
        </button>
        <div className="min-w-0">
          <button
            type="button"
            onClick={handleDetails}
            className="cursor-pointer block w-full rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
            aria-label={`Открыть сведения: ${item.title}`}
          >
            <span className="mb-0.5 flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 text-[9px] font-mono tabular-nums" style={{ color: item.color }}>
                {item.startTime}–{item.endTime}
              </span>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
              <span className="truncate text-[9px] font-medium text-(--text-muted)">{meta.label}</span>
              {item.description && (
                <span className="ml-auto inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-(--text-muted)" style={{ border: "1px solid var(--glass-border)" }} title="Есть описание">
                  <InfoIcon />
                </span>
              )}
            </span>
            <span className="block text-[11px] font-semibold leading-[1.15] text-(--text-primary)" style={twoLineClampStyle}>
              {item.title}
            </span>
          </button>
        </div>
        {isAdmin && (
          <div className="col-start-2 ml-1 flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <IconButton label={`Править задачу: ${item.title}`} title="Править" onClick={handleEditStart}>
              <EditIcon />
            </IconButton>
            <IconButton label={`Удалить задачу: ${item.title}`} title="Удалить" tone="danger" onClick={handleDelete}>
              <TrashIcon />
            </IconButton>
          </div>
        )}
      </div>
    </article>
  );
});

// ─── TaskDetailsDialog ────────────────────────────────────────────────────────

function TaskDetailsDialog({
  selectedTask,
  users,
  weekDates,
  completions,
  isEditing,
  isAdmin,
  busyId,
  onClose,
  onToggle,
  onEditStart,
  onEditCancel,
  onEdit,
  onDelete,
}: {
  selectedTask: SelectedTask | null;
  users: PersonalPlanUserBlock[];
  weekDates: PersonalPlanWeekDate[];
  completions: DbPersonalPlanCompletion[];
  isEditing: boolean;
  isAdmin: boolean;
  busyId: number | null;
  onClose: () => void;
  onToggle: (item: DbPersonalPlanItem, completions: DbPersonalPlanCompletion[]) => void;
  onEditStart: (id: number) => void;
  onEditCancel: () => void;
  onEdit: (event: FormEvent<HTMLFormElement>, itemId: number) => void;
  onDelete: (itemId: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const item = selectedTask?.item;
  const state = useMemo(
    () => (item ? getPersonalPlanItemState(item, completions) : null),
    [item, completions],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedTask && !dialog.open) { dialog.showModal(); return; }
    if (!selectedTask && dialog.open) dialog.close();
  }, [selectedTask]);

  const handleToggle = useCallback(() => {
    if (item) onToggle(item, completions);
  }, [item, completions, onToggle]);

  const handleDelete = useCallback(() => {
    if (item) onDelete(item.id);
  }, [item, onDelete]);

  const handleEditStart = useCallback(() => {
    if (item) onEditStart(item.id);
  }, [item, onEditStart]);

  const handleEdit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      if (item) onEdit(event, item.id);
    },
    [item, onEdit],
  );

  if (!selectedTask || !item || !state) {
    return <dialog ref={dialogRef} className="hidden" onClose={onClose} />;
  }

  const meta = statusMeta[state.status];

  const dialogStyle: CSSProperties = {
    background: "linear-gradient(145deg, var(--bg-elevated), var(--bg-surface))",
    border: SURFACE_BORDER,
    boxShadow: "var(--shadow-overlay)",
  };

  const toggleBtnStyle: CSSProperties = state.isCompleted
    ? { background: "rgba(52,211,153,0.14)", color: "#34d399", border: "1px solid rgba(52,211,153,0.32)" }
    : { background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.32)" };

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="m-auto w-[min(760px,calc(100vw-24px))] rounded-[24px] p-0 text-(--text-primary) shadow-2xl backdrop:bg-slate-950/75 focus-visible:outline-none"
      style={dialogStyle}
      aria-labelledby="personal-plan-task-dialog-title"
    >
      <div className="relative overflow-hidden rounded-[24px]">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${item.color}, ${meta.color})` }} />
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div
              className="mt-1 h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center text-xs font-bold text-white"
              style={{ background: selectedTask.block.user.roleMeta.hex, boxShadow: `0 0 22px ${selectedTask.block.user.roleMeta.hex}38` }}
            >
              {selectedTask.block.user.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: meta.color }}>
                {meta.label}
              </p>
              <h3 id="personal-plan-task-dialog-title" className="mt-1 text-lg font-semibold leading-tight text-(--text-primary)">
                {isEditing ? "Редактирование задачи" : item.title}
              </h3>
              <p className="mt-1 text-xs text-(--text-muted)">
                {selectedTask.block.user.name} · {selectedTask.day.label}, {selectedTask.day.isoDate.slice(5)}
              </p>
            </div>
            <form method="dialog">
              <button
                type="submit"
                aria-label="Закрыть сведения о задаче"
                className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-xl text-sm text-(--text-muted) transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                style={{ border: SURFACE_BORDER }}
              >
                <XIcon />
              </button>
            </form>
          </div>

          {isEditing ? (
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--glass-border)" }}>
              <PlanItemForm users={users} weekDates={weekDates} item={item} onSubmit={handleEdit} />
              <button
                type="button"
                onClick={onEditCancel}
                className="cursor-pointer mt-3 rounded-xl px-3 py-2 text-xs font-semibold text-(--text-muted) transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                style={{ border: "1px solid var(--glass-border)" }}
              >
                Отмена
              </button>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl p-2.5" style={{ background: "var(--glass-01)", border: SURFACE_BORDER }}>
                  <dt className="text-[10px] uppercase tracking-widest text-(--text-muted)">Время</dt>
                  <dd className="mt-1 font-mono text-(--text-primary)">{item.startTime}–{item.endTime}</dd>
                </div>
                <div className="rounded-2xl p-2.5" style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
                  <dt className="text-[10px] uppercase tracking-widest text-(--text-muted)">Статус</dt>
                  <dd className="mt-1 font-semibold" style={{ color: meta.color }}>{meta.label}</dd>
                </div>
              </dl>

              <section className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.025)", border: SURFACE_BORDER }}>
                <h4 className="text-[10px] uppercase tracking-widest text-(--text-muted)">Описание</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-(--text-secondary)">
                  {item.description || "Описание не добавлено."}
                </p>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={handleToggle}
                  className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                  style={toggleBtnStyle}
                >
                  {state.isCompleted ? "Снять отметку" : "Отметить выполненной"}
                </button>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleEditStart}
                      className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold text-(--text-secondary) transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                      style={{ border: "1px solid var(--glass-border)" }}
                    >
                      Править
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                      style={{ border: "1px solid rgba(239,68,68,0.24)" }}
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="py-16 text-center rounded-2xl"
      style={{ border: "1px dashed var(--glass-border)", background: "var(--glass-01)" }}
    >
      <p className="text-base font-semibold text-(--text-secondary)">Нет сотрудников постоянного состава</p>
      <p className="text-sm mt-1 text-(--text-muted)">Проверьте роли и состав в настройках.</p>
    </div>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────

function IconButton({
  label,
  title,
  tone = "neutral",
  onClick,
  children,
}: {
  label: string;
  title: string;
  tone?: "neutral" | "danger";
  onClick: () => void;
  children: ReactNode;
}) {
  const btnStyle: CSSProperties =
    tone === "danger"
      ? { border: "1px solid rgba(239,68,68,0.24)" }
      : { border: SURFACE_BORDER };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={`cursor-pointer flex h-5 min-w-5 items-center justify-center rounded-md text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
        tone === "danger"
          ? "text-red-300 focus-visible:outline-red-400 hover:bg-red-500/10"
          : "text-(--text-muted) focus-visible:outline-violet-400 hover:bg-white/[0.05] hover:text-(--text-primary)"
      }`}
      style={btnStyle}
    >
      {children}
    </button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3.5v9M3.5 8h9" /></svg>;
}

function CheckIcon() {
  return <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.2 6.7 11.2 12.7 4.8" /></svg>;
}

function EditIcon() {
  return <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 3.2 12.8 6.1M3.2 12.8l3.1-.7 6.2-6.2a1.9 1.9 0 0 0-2.7-2.7L3.9 9.4z" /></svg>;
}

function TrashIcon() {
  return <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3.2 4.5h9.6M6.3 4.5V3.2h3.4v1.3M5 6.4l.4 5.2c.1.8.5 1.2 1.3 1.2h2.6c.8 0 1.2-.4 1.3-1.2l.4-5.2" /></svg>;
}

function InfoIcon() {
  return <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 7v4.2" /><path d="M8 4.8h.01" /></svg>;
}

function XIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7" /></svg>;
}

function ChevronDownIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const twoLineClampStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

function chipStyle(active: boolean, color = "#8b5cf6"): CSSProperties {
  return {
    background: `${color}18`,
    color,
    border: `1px solid ${color}44`,
  };
}
