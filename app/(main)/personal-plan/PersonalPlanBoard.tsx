"use client";

import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
const SURFACE_BORDER = "1px solid var(--glass-border)";
const PANEL_SHADOW = "0 18px 52px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.035)";

const statusMeta = {
  completed: { label: "Готово", color: "#34d399", bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.28)" },
  overdue: { label: "Просрочено", color: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.42)" },
  current: { label: "Сейчас", color: "#38bdf8", bg: "rgba(56,189,248,0.10)", border: "rgba(56,189,248,0.32)" },
  upcoming: { label: "План", color: "#94a3b8", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.20)" },
} as const;

function timeNowLabel() {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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
    () => selectedUserId === "all"
      ? data.users
      : data.users.filter((block) => block.user.id === selectedUserId),
    [data.users, selectedUserId],
  );

  const summary = useMemo(() => {
    const allItems = data.users.flatMap((block) => block.items);
    const states = allItems.map((item) => getPersonalPlanItemState(item, data.completions));
    const completed = states.filter((state) => state.isCompleted).length;
    return {
      total: allItems.length,
      completed,
      overdue: states.filter((state) => state.isOverdue).length,
      current: states.filter((state) => state.isCurrent).length,
      progress: allItems.length ? Math.round((completed / allItems.length) * 100) : 0,
    };
  }, [data]);

  async function mutate(url: string, init: RequestInit, busy?: number) {
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
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = formPayload(form);
    const ok = await mutate("/api/personal-plan", { method: "POST", body: JSON.stringify(payload) });
    if (ok) {
      event.currentTarget.reset();
      setAdding(false);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>, itemId: number) {
    event.preventDefault();
    const payload = formPayload(new FormData(event.currentTarget));
    const ok = await mutate(`/api/personal-plan/${itemId}`, { method: "PATCH", body: JSON.stringify(payload) }, itemId);
    if (ok) {
      setEditingTaskId(null);
      setSelectedTask(null);
    }
  }

  async function toggleCompletion(item: DbPersonalPlanItem, completions: DbPersonalPlanCompletion[]) {
    const state = getPersonalPlanItemState(item, completions);
    await mutate(`/api/personal-plan/${item.id}/completion`, {
      method: "PATCH",
      body: JSON.stringify({ date: state.occurrenceDate, completed: !state.isCompleted }),
    }, item.id);
  }

  async function deleteItem(itemId: number) {
    if (!window.confirm("Удалить задачу из повторяющегося личного плана?")) return;
    const ok = await mutate(`/api/personal-plan/${itemId}`, { method: "DELETE" }, itemId);
    if (ok) setSelectedTask((current) => current?.item.id === itemId ? null : current);
  }

  function toggleUserPlan(userId: number) {
    setCollapsedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="p-3 lg:p-4 space-y-3" aria-label="Личный план недели">
        <section
          className="relative overflow-hidden rounded-[22px] px-3.5 py-3 lg:px-4"
          style={{
            background: "radial-gradient(circle at 18% 10%, rgba(139,92,246,0.22), transparent 32%), radial-gradient(circle at 86% 18%, rgba(56,189,248,0.14), transparent 28%), linear-gradient(135deg, rgba(15,23,42,0.82), rgba(2,6,23,0.22))",
            border: SURFACE_BORDER,
            boxShadow: PANEL_SHADOW,
          }}
        >
          <div className="absolute -right-16 -top-28 h-56 w-56 rounded-full bg-[rgba(139,92,246,0.13)] blur-3xl" />
          <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="relative flex flex-wrap items-center gap-3">
            <div className="min-w-64 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--accent-400)" }}>
                Оперативная неделя
              </p>
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-(--text-primary)">
                Личный план без лишнего шума
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-(--text-secondary)">
                Компактная 7-дневная сетка: быстрый фокус на сотруднике, статусе выполнения и просроченных задачах.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Metric label="Всего" value={summary.total} color="#a78bfa" />
              <Metric label="Готово" value={summary.completed} color="#34d399" />
              <Metric label="Сейчас" value={summary.current} color="#38bdf8" />
              <Metric label="Проср." value={summary.overdue} color="#f87171" pulse={summary.overdue > 0} />
            </div>
            <div className="w-full">
              <ProgressRail value={summary.progress} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl px-2.5 py-2" style={{ background: "var(--glass-01)", border: SURFACE_BORDER }}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-(--text-muted)">Фокус</span>
            <button type="button" onClick={() => setSelectedUserId("all")} className="cursor-pointer px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={chipStyle(selectedUserId === "all")}>Все планы</button>
            {data.users.map((block) => (
              <button type="button" key={block.user.id} onClick={() => setSelectedUserId(block.user.id)} className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={chipStyle(selectedUserId === block.user.id, block.user.roleMeta.hex)}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: block.user.roleMeta.hex }} />
                {block.user.name}
              </button>
            ))}
            <span className="ml-auto rounded-lg px-2 py-1 text-[11px] font-mono text-(--text-muted)" style={{ border: SURFACE_BORDER }}>сейчас {timeNowLabel()}</span>
          </div>
        </section>

        {isAdmin && data.users.length > 0 && (
          <section className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-elevated)", border: SURFACE_BORDER, boxShadow: "var(--shadow-card)" }}>
            <button type="button" onClick={() => setAdding((value) => !value)} className="cursor-pointer w-full px-3 py-2.5 flex items-center justify-between text-left transition-colors hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400">
              <span className="flex items-center gap-2 text-xs font-semibold text-(--text-primary)">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl text-(--accent-400)" style={{ background: "var(--accent-glow)", border: "1px solid rgba(139,92,246,0.26)" }}>
                  <PlusIcon />
                </span>
                Новая повторяющаяся задача
              </span>
              <span className="rounded-lg px-2 py-1 text-[11px] font-mono text-(--text-muted)" style={{ border: SURFACE_BORDER }}>{adding ? "закрыть" : "admin"}</span>
            </button>
            <AnimatePresence initial={false}>
              {adding && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                  <div className="p-3 pt-0"><PlanItemForm users={data.users} weekDates={data.weekDates} onSubmit={handleAdd} /></div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {visibleBlocks.length === 0 ? <EmptyState /> : (
          <div className="space-y-3">
            {visibleBlocks.map((block, idx) => (
              <motion.section
                data-testid="personal-plan-user-week"
                key={block.user.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.025 }}
                className="rounded-[22px] overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${block.user.roleMeta.hex}0d, transparent 34%), var(--bg-elevated)`,
                  border: SURFACE_BORDER,
                  boxShadow: PANEL_SHADOW,
                }}
              >
                {(() => {
                  const isCollapsed = collapsedUserIds.has(block.user.id);
                  const panelId = `personal-plan-user-${block.user.id}-week`;
                  return (
                    <>
                      <UserPlanHeader block={block} completions={data.completions} isCollapsed={isCollapsed} panelId={panelId} onToggle={() => toggleUserPlan(block.user.id)} />
                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div id={panelId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: "easeOut" }} style={{ overflow: "hidden" }}>
                            <div className="overflow-x-auto">
                              <div data-testid="personal-plan-week-grid" className="grid min-w-[980px] gap-1.5 p-2 lg:min-w-0" style={{ gridTemplateColumns: PERSONAL_PLAN_WEEK_COLUMN_TEMPLATE }}>
                                {data.weekDates.map((day) => (
                                  <DayColumn
                                    key={`${block.user.id}-${day.isoDate}`}
                                    block={block}
                                    day={day}
                                    completions={data.completions}
                                    isAdmin={isAdmin}
                                    busyId={busyId}
                                    onDetails={(task) => {
                                      setEditingTaskId(null);
                                      setSelectedTask(task);
                                    }}
                                    onEditStart={(task) => {
                                      setSelectedTask(task);
                                      setEditingTaskId(task.item.id);
                                    }}
                                    onDelete={deleteItem}
                                    onToggle={toggleCompletion}
                                  />
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  );
                })()}
              </motion.section>
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
          onClose={() => {
            setEditingTaskId(null);
            setSelectedTask(null);
          }}
          onToggle={toggleCompletion}
          onEditStart={(id) => setEditingTaskId(id)}
          onEditCancel={() => setEditingTaskId(null)}
          onEdit={handleEdit}
          onDelete={deleteItem}
        />

        {(isPending || busyId !== null) && (
          <div className="fixed bottom-5 right-5 px-3 py-2 rounded-xl text-xs font-semibold shadow-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}>Сохраняю изменения…</div>
        )}
      </main>
    </div>
  );
}

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

function Metric({ label, value, color, pulse = false }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div className="rounded-xl px-2.5 py-1.5 min-w-16" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)" }}>
      <p className="text-[9px] uppercase tracking-wider text-(--text-muted)">{label}</p>
      <motion.p className="text-sm font-semibold font-mono leading-tight" style={{ color }} animate={pulse ? { opacity: [1, 0.55, 1] } : undefined} transition={pulse ? { duration: 1.4, repeat: Infinity } : undefined}>{value}</motion.p>
    </div>
  );
}

function ProgressRail({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} aria-hidden="true">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #8b5cf6, #38bdf8, #34d399)" }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>
      <span className="w-10 text-right text-[10px] font-mono text-(--text-muted)" aria-label={`Выполнено ${value}%`}>{value}%</span>
    </div>
  );
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "danger" }) {
  const style = tone === "danger"
    ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.26)", color: "#fca5a5" }
    : { background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.075)", color: "var(--text-muted)" };

  return <span className="rounded-lg px-2 py-1 text-[11px] font-mono" style={style}>{label}</span>;
}

function PlanItemForm({ users, weekDates, item, onSubmit }: { users: PersonalPlanUserBlock[]; weekDates: PersonalPlanWeekDate[]; item?: DbPersonalPlanItem; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const userOptions = users.map((block) => ({
    value: block.user.id,
    label: block.user.name,
    description: block.user.roleMeta.label,
    color: block.user.roleMeta.hex,
  }));
  const weekdayOptions = weekDates.map((day) => ({
    value: day.weekday,
    label: day.label,
    description: day.isoDate.slice(5),
    color: day.isToday ? "#a78bfa" : "#64748b",
  }));
  const colorOptions = PLAN_COLORS.map((color) => ({ value: color, label: color.toUpperCase(), color }));

  return (
    <form onSubmit={onSubmit} className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[1.15fr_0.9fr_1fr_0.55fr_0.55fr_0.6fr_auto]">
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Сотрудник</span><SelectField name="userId" defaultValue={item?.userId ?? users[0]?.user.id} options={userOptions} compact /></label>
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">День</span><SelectField name="weekday" defaultValue={item?.weekday ?? 1} options={weekdayOptions} compact /></label>
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Название</span><input name="title" required maxLength={200} defaultValue={item?.title} className="form-field" placeholder="Планёрка" /></label>
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">С</span><input name="startTime" type="time" required defaultValue={item?.startTime ?? "09:00"} className="form-field" /></label>
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">До</span><input name="endTime" type="time" required defaultValue={item?.endTime ?? "10:00"} className="form-field" /></label>
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Цвет</span><SelectField name="color" defaultValue={item?.color ?? PLAN_COLORS[0]} options={colorOptions} compact /></label>
      <label className="grid gap-1 md:col-span-2 xl:col-span-6"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Описание</span><input name="description" maxLength={2000} defaultValue={item?.description ?? ""} className="form-field" placeholder="Комментарий или критерий выполнения" /></label>
      <button type="submit" className="cursor-pointer self-end px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.28), rgba(56,189,248,0.14))", color: "var(--accent-300)", border: "1px solid rgba(139,92,246,0.34)", boxShadow: "0 10px 28px rgba(139,92,246,0.12)" }}>Сохранить</button>
    </form>
  );
}

function UserPlanHeader({ block, completions, isCollapsed, panelId, onToggle }: { block: PersonalPlanUserBlock; completions: DbPersonalPlanCompletion[]; isCollapsed: boolean; panelId: string; onToggle: () => void }) {
  const states = block.items.map((item) => getPersonalPlanItemState(item, completions));
  const done = states.filter((state) => state.isCompleted).length;
  const overdue = states.filter((state) => state.isOverdue).length;
  const pct = block.items.length ? Math.round((done / block.items.length) * 100) : 0;

  return (
    <div className="px-3 py-2.5 flex items-center gap-2.5" style={{ borderBottom: SURFACE_BORDER, background: `linear-gradient(120deg, ${block.user.roleMeta.hex}14, transparent 58%)` }}>
      <div className="h-9 w-9 rounded-2xl flex items-center justify-center text-xs font-bold text-white" style={{ background: block.user.roleMeta.hex, boxShadow: `0 0 18px ${block.user.roleMeta.hex}45` }}>{block.user.initials}</div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-tight truncate text-(--text-primary)">{block.user.name}</h3>
        <p className="text-[11px] truncate text-(--text-muted)">{block.user.roleMeta.short} · {block.user.roleMeta.label}</p>
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">
        <StatusPill label={`${block.items.length} задач`} />
        {overdue > 0 && <StatusPill label={`${overdue} просрочено`} tone="danger" />}
      </div>
      <div className="w-28">
        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
          <span style={{ color: block.user.roleMeta.hex }}>{pct}%</span>
          <span className="text-(--text-muted)">{done}/{block.items.length}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <motion.div className="h-full rounded-full" style={{ background: block.user.roleMeta.hex }} animate={{ width: `${pct}%` }} />
        </div>
      </div>
      <button
        type="button"
        aria-controls={panelId}
        aria-expanded={!isCollapsed}
        onClick={onToggle}
        className="cursor-pointer flex h-8 min-w-8 items-center justify-center rounded-xl text-[11px] font-semibold text-(--text-muted) transition-all hover:bg-white/[0.045] hover:text-(--text-primary) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        style={{ border: SURFACE_BORDER }}
        title={isCollapsed ? "Развернуть план" : "Свернуть план"}
      >
        <motion.span animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.16 }}>⌄</motion.span>
      </button>
    </div>
  );
}

function DayColumn({ block, day, completions, isAdmin, busyId, onDetails, onEditStart, onDelete, onToggle }: { block: PersonalPlanUserBlock; day: PersonalPlanWeekDate; completions: DbPersonalPlanCompletion[]; isAdmin: boolean; busyId: number | null; onDetails: (task: SelectedTask) => void; onEditStart: (task: SelectedTask) => void; onDelete: (itemId: number) => void; onToggle: (item: DbPersonalPlanItem, completions: DbPersonalPlanCompletion[]) => void }) {
  const items = block.items.filter((item) => item.weekday === day.weekday);
  const overdue = items.filter((item) => getPersonalPlanItemState(item, completions).isOverdue).length;
  const hasOverflow = items.length > PERSONAL_PLAN_DENSE_DAY_ITEM_CAPACITY;

  return (
    <div className="min-w-0 rounded-2xl overflow-hidden transition-colors" style={{ background: day.isToday ? "rgba(139,92,246,0.085)" : "rgba(255,255,255,0.018)", border: day.isToday ? "1px solid rgba(139,92,246,0.34)" : SURFACE_BORDER, boxShadow: day.isToday ? "0 0 0 1px rgba(139,92,246,0.08), 0 12px 28px rgba(139,92,246,0.08)" : "none" }}>
      <div className="px-2 py-1.5 flex items-center justify-between gap-1" style={{ borderBottom: SURFACE_BORDER }}>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-tight text-(--text-primary)">{day.shortLabel}</p>
          <p className="text-[9px] font-mono leading-tight text-(--text-muted)">{day.isoDate.slice(5)}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <span className="rounded-md px-1.5 py-0.5 text-(--text-muted)" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>{items.length}</span>
          {day.isToday && <span className="rounded-md px-1.5 py-0.5 font-semibold text-violet-300" style={{ background: "rgba(139,92,246,0.16)" }}>сегодня</span>}
          {overdue > 0 && <span className="rounded-md px-1.5 py-0.5 font-bold text-red-300" style={{ background: "rgba(239,68,68,0.14)" }} title="Просрочено">{overdue}</span>}
        </div>
      </div>
      <div className="p-1.5 flex flex-col gap-1 overscroll-contain" style={{ maxHeight: `${DENSE_DAY_MAX_HEIGHT}px`, overflowY: hasOverflow ? "auto" : "hidden" }}>
        {items.length === 0 ? <div className="h-7 rounded-xl flex items-center justify-center text-[11px] text-(--text-muted)" style={{ border: "1px dashed var(--glass-border)" }}>свободно</div> : items.map((item) => <PersonalPlanItemRow key={item.id} block={block} item={item} day={day} completions={completions} isAdmin={isAdmin} busyId={busyId} onDetails={onDetails} onEditStart={onEditStart} onDelete={onDelete} onToggle={onToggle} />)}
      </div>
    </div>
  );
}

function PersonalPlanItemRow({ block, item, day, completions, isAdmin, busyId, onDetails, onEditStart, onDelete, onToggle }: { block: PersonalPlanUserBlock; item: DbPersonalPlanItem; day: PersonalPlanWeekDate; completions: DbPersonalPlanCompletion[]; isAdmin: boolean; busyId: number | null; onDetails: (task: SelectedTask) => void; onEditStart: (task: SelectedTask) => void; onDelete: (itemId: number) => void; onToggle: (item: DbPersonalPlanItem, completions: DbPersonalPlanCompletion[]) => void }) {
  const state = getPersonalPlanItemState(item, completions);
  const meta = statusMeta[state.status];
  const detailsHint = item.description ? "Есть описание" : "Открыть детали";

  return (
    <motion.article layout className="group relative min-h-[50px] rounded-xl overflow-hidden transition-colors" style={{ background: state.isCompleted ? "rgba(255,255,255,0.024)" : meta.bg, border: `1px solid ${state.isOverdue ? meta.border : "var(--glass-border)"}`, boxShadow: state.isOverdue ? "0 0 14px rgba(239,68,68,0.12)" : state.isCurrent ? "0 0 12px rgba(56,189,248,0.11)" : "none" }}>
      <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: item.color }} />
      {state.isOverdue && <motion.div className="absolute inset-0 pointer-events-none" animate={{ opacity: [0.13, 0.03, 0.13] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.20), transparent)" }} />}
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-1.5 py-1.5 pl-2 pr-1.5">
        <button type="button" disabled={busyId === item.id} onClick={() => onToggle(item, completions)} aria-label={state.isCompleted ? "Снять отметку выполнения" : "Отметить задачу выполненной"} className="cursor-pointer mt-0.5 h-5 w-5 rounded-lg shrink-0 flex items-center justify-center text-[10px] leading-none transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={{ background: state.isCompleted ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${state.isCompleted ? "rgba(52,211,153,0.4)" : "var(--glass-border)"}`, color: state.isCompleted ? "#34d399" : "var(--text-muted)" }} title="Отметить выполнение">{state.isCompleted && <CheckIcon />}</button>
        <div className="min-w-0">
          <button type="button" onClick={() => onDetails({ block, day, item })} className="cursor-pointer block w-full rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" aria-label={`Открыть сведения: ${item.title}`}>
            <span className="mb-0.5 flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 text-[9px] font-mono tabular-nums" style={{ color: item.color }}>{item.startTime}–{item.endTime}</span>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
              <span className="truncate text-[9px] font-medium text-(--text-muted)">{meta.label}</span>
              {item.description && <span className="ml-auto shrink-0 rounded-md px-1 text-[8px] font-semibold text-(--text-muted)" style={{ border: "1px solid var(--glass-border)" }}>i</span>}
            </span>
            <span className="block text-[11px] font-semibold leading-[1.15] text-(--text-primary)" style={twoLineClampStyle}>{item.title}</span>
            <span className="sr-only">{detailsHint}</span>
          </button>
        </div>
        {isAdmin && (
          <div className="col-start-2 ml-1 flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <IconButton label={`Править задачу: ${item.title}`} title="Править" onClick={() => onEditStart({ block, day, item })}><EditIcon /></IconButton>
            <IconButton label={`Удалить задачу: ${item.title}`} title="Удалить" tone="danger" onClick={() => onDelete(item.id)}><TrashIcon /></IconButton>
          </div>
        )}
      </div>
    </motion.article>
  );
}

function TaskDetailsDialog({ selectedTask, users, weekDates, completions, isEditing, isAdmin, busyId, onClose, onToggle, onEditStart, onEditCancel, onEdit, onDelete }: { selectedTask: SelectedTask | null; users: PersonalPlanUserBlock[]; weekDates: PersonalPlanWeekDate[]; completions: DbPersonalPlanCompletion[]; isEditing: boolean; isAdmin: boolean; busyId: number | null; onClose: () => void; onToggle: (item: DbPersonalPlanItem, completions: DbPersonalPlanCompletion[]) => void; onEditStart: (id: number) => void; onEditCancel: () => void; onEdit: (event: FormEvent<HTMLFormElement>, itemId: number) => void; onDelete: (itemId: number) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const item = selectedTask?.item;
  const state = item ? getPersonalPlanItemState(item, completions) : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (selectedTask && !dialog.open) {
      dialog.showModal();
      return;
    }

    if (!selectedTask && dialog.open) dialog.close();
  }, [selectedTask]);

  if (!selectedTask || !item || !state) {
    return <dialog ref={dialogRef} className="hidden" onClose={onClose} />;
  }

  const meta = statusMeta[state.status];

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(760px,calc(100vw-24px))] rounded-[24px] p-0 text-(--text-primary) shadow-2xl backdrop:bg-slate-950/75 focus-visible:outline-none"
      style={{ background: "linear-gradient(145deg, var(--bg-elevated), var(--bg-surface))", border: SURFACE_BORDER, boxShadow: "var(--shadow-overlay)" }}
      aria-labelledby="personal-plan-task-dialog-title"
    >
      <div className="relative overflow-hidden rounded-[24px]">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${item.color}, ${meta.color})` }} />
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center text-xs font-bold text-white" style={{ background: selectedTask.block.user.roleMeta.hex, boxShadow: `0 0 22px ${selectedTask.block.user.roleMeta.hex}38` }}>{selectedTask.block.user.initials}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: meta.color }}>{meta.label}</p>
              <h3 id="personal-plan-task-dialog-title" className="mt-1 text-lg font-semibold leading-tight text-(--text-primary)">{isEditing ? "Редактирование задачи" : item.title}</h3>
              <p className="mt-1 text-xs text-(--text-muted)">{selectedTask.block.user.name} · {selectedTask.day.label}, {selectedTask.day.isoDate.slice(5)}</p>
            </div>
            <form method="dialog">
              <button type="submit" aria-label="Закрыть сведения о задаче" className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-xl text-sm text-(--text-muted) transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={{ border: SURFACE_BORDER }}>X</button>
            </form>
          </div>

          {isEditing ? (
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--glass-border)" }}>
              <PlanItemForm users={users} weekDates={weekDates} item={item} onSubmit={(event) => onEdit(event, item.id)} />
              <button type="button" onClick={onEditCancel} className="cursor-pointer mt-3 rounded-xl px-3 py-2 text-xs font-semibold text-(--text-muted) transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={{ border: "1px solid var(--glass-border)" }}>Отмена</button>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl p-2.5" style={{ background: "var(--glass-01)", border: SURFACE_BORDER }}><dt className="text-[10px] uppercase tracking-widest text-(--text-muted)">Время</dt><dd className="mt-1 font-mono text-(--text-primary)">{item.startTime}–{item.endTime}</dd></div>
                <div className="rounded-2xl p-2.5" style={{ background: meta.bg, border: `1px solid ${meta.border}` }}><dt className="text-[10px] uppercase tracking-widest text-(--text-muted)">Статус</dt><dd className="mt-1 font-semibold" style={{ color: meta.color }}>{meta.label}</dd></div>
              </dl>

              <section className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.025)", border: SURFACE_BORDER }}>
                <h4 className="text-[10px] uppercase tracking-widest text-(--text-muted)">Описание</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-(--text-secondary)">{item.description || "Описание не добавлено."}</p>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button type="button" disabled={busyId === item.id} onClick={() => onToggle(item, completions)} className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={{ background: state.isCompleted ? "rgba(52,211,153,0.14)" : "var(--accent-glow)", color: state.isCompleted ? "#34d399" : "var(--accent-400)", border: `1px solid ${state.isCompleted ? "rgba(52,211,153,0.32)" : "rgba(139,92,246,0.32)"}` }}>
                  {state.isCompleted ? "Снять отметку" : "Отметить выполненной"}
                </button>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onEditStart(item.id)} className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold text-(--text-secondary) transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={{ border: "1px solid var(--glass-border)" }}>Править</button>
                    <button type="button" onClick={() => onDelete(item.id)} className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400" style={{ border: "1px solid rgba(239,68,68,0.24)" }}>Удалить</button>
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

function EmptyState() {
  return <div className="py-16 text-center rounded-2xl" style={{ border: "1px dashed var(--glass-border)", background: "var(--glass-01)" }}><p className="text-base font-semibold text-(--text-secondary)">Нет сотрудников постоянного состава</p><p className="text-sm mt-1 text-(--text-muted)">Проверьте роли и состав в настройках.</p></div>;
}

function IconButton({ label, title, tone = "neutral", onClick, children }: { label: string; title: string; tone?: "neutral" | "danger"; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={`cursor-pointer flex h-5 min-w-5 items-center justify-center rounded-md text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${tone === "danger" ? "text-red-300 focus-visible:outline-red-400 hover:bg-red-500/10" : "text-(--text-muted) focus-visible:outline-violet-400 hover:bg-white/[0.05] hover:text-(--text-primary)"}`}
      style={{ border: tone === "danger" ? "1px solid rgba(239,68,68,0.24)" : SURFACE_BORDER }}
    >
      {children}
    </button>
  );
}

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

const twoLineClampStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

function chipStyle(active: boolean, color = "#8b5cf6"): CSSProperties {
  return { background: active ? `${color}18` : "var(--glass-01)", color: active ? color : "var(--text-muted)", border: `1px solid ${active ? color + "44" : "var(--glass-border)"}` };
}
