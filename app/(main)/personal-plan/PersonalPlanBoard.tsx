"use client";

import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
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
    return {
      total: allItems.length,
      completed: states.filter((state) => state.isCompleted).length,
      overdue: states.filter((state) => state.isOverdue).length,
      current: states.filter((state) => state.isCurrent).length,
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
      <div className="p-3 lg:p-4 space-y-3">
        <section
          className="relative overflow-hidden rounded-2xl px-3 py-2.5"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.13), rgba(56,189,248,0.055) 45%, rgba(15,23,42,0.05))",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div className="absolute -right-16 -top-28 h-48 w-48 rounded-full bg-[rgba(139,92,246,0.13)] blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-2.5">
            <div className="min-w-56 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--accent-400)" }}>
                Повторяется каждую неделю
              </p>
              <h2 className="mt-0.5 text-base font-semibold tracking-tight text-(--text-primary)">
                Неделя сотрудника в одном экране
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Metric label="Всего" value={summary.total} color="#a78bfa" />
              <Metric label="Готово" value={summary.completed} color="#34d399" />
              <Metric label="Сейчас" value={summary.current} color="#38bdf8" />
              <Metric label="Проср." value={summary.overdue} color="#f87171" pulse={summary.overdue > 0} />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setSelectedUserId("all")} className="cursor-pointer px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={chipStyle(selectedUserId === "all")}>Все</button>
          {data.users.map((block) => (
            <button type="button" key={block.user.id} onClick={() => setSelectedUserId(block.user.id)} className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={chipStyle(selectedUserId === block.user.id, block.user.roleMeta.hex)}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: block.user.roleMeta.hex }} />
              {block.user.name}
            </button>
          ))}
          <span className="ml-auto text-[11px] font-mono text-(--text-muted)">сейчас {timeNowLabel()}</span>
        </div>

        {isAdmin && data.users.length > 0 && (
          <section className="rounded-xl overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
            <button type="button" onClick={() => setAdding((value) => !value)} className="cursor-pointer w-full px-3 py-2 flex items-center justify-between text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400">
              <span className="text-xs font-semibold text-(--text-primary)">Добавить задачу в личный план</span>
              <span className="text-[11px] font-mono text-(--text-muted)">{adding ? "закрыть" : "admin"}</span>
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
              <motion.section data-testid="personal-plan-user-week" key={block.user.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: idx * 0.025 }} className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
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
      </div>
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
    <div className="rounded-lg px-2 py-1 min-w-14" style={{ background: "rgba(255,255,255,0.032)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-[9px] uppercase tracking-wider text-(--text-muted)">{label}</p>
      <motion.p className="text-sm font-semibold font-mono leading-tight" style={{ color }} animate={pulse ? { opacity: [1, 0.55, 1] } : undefined} transition={pulse ? { duration: 1.4, repeat: Infinity } : undefined}>{value}</motion.p>
    </div>
  );
}

function PlanItemForm({ users, weekDates, item, onSubmit }: { users: PersonalPlanUserBlock[]; weekDates: PersonalPlanWeekDate[]; item?: DbPersonalPlanItem; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.7fr_0.6fr_0.6fr_auto]">
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Сотрудник</span><select name="userId" defaultValue={item?.userId ?? users[0]?.user.id} className="form-field">{users.map((block) => <option key={block.user.id} value={block.user.id}>{block.user.name}</option>)}</select></label>
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">День</span><select name="weekday" defaultValue={item?.weekday ?? 1} className="form-field">{weekDates.map((day) => <option key={day.weekday} value={day.weekday}>{day.label}</option>)}</select></label>
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Название</span><input name="title" required maxLength={200} defaultValue={item?.title} className="form-field" placeholder="Планёрка" /></label>
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">С</span><input name="startTime" type="time" required defaultValue={item?.startTime ?? "09:00"} className="form-field" /></label>
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">До</span><input name="endTime" type="time" required defaultValue={item?.endTime ?? "10:00"} className="form-field" /></label>
      <label className="grid gap-1"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Цвет</span><select name="color" defaultValue={item?.color ?? PLAN_COLORS[0]} className="form-field">{PLAN_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}</select></label>
      <label className="grid gap-1 md:col-span-2 xl:col-span-5"><span className="text-[10px] uppercase tracking-widest text-(--text-muted)">Описание</span><input name="description" maxLength={2000} defaultValue={item?.description ?? ""} className="form-field" placeholder="Комментарий или критерий выполнения" /></label>
      <button type="submit" className="cursor-pointer self-end px-4 py-2 rounded-xl text-xs font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={{ background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.32)" }}>Сохранить</button>
    </form>
  );
}

function UserPlanHeader({ block, completions, isCollapsed, panelId, onToggle }: { block: PersonalPlanUserBlock; completions: DbPersonalPlanCompletion[]; isCollapsed: boolean; panelId: string; onToggle: () => void }) {
  const states = block.items.map((item) => getPersonalPlanItemState(item, completions));
  const done = states.filter((state) => state.isCompleted).length;
  const overdue = states.filter((state) => state.isOverdue).length;
  const pct = block.items.length ? Math.round((done / block.items.length) * 100) : 0;

  return (
    <div className="px-3 py-2 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--glass-border)", background: `linear-gradient(120deg, ${block.user.roleMeta.hex}10, transparent 55%)` }}>
      <div className="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold text-white" style={{ background: block.user.roleMeta.hex, boxShadow: `0 0 14px ${block.user.roleMeta.hex}35` }}>{block.user.initials}</div>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold leading-tight truncate text-(--text-primary)">{block.user.name}</h3><p className="text-[11px] truncate text-(--text-muted)">{block.user.roleMeta.short} · {block.user.roleMeta.label}</p></div>
      <span className="text-[11px] font-mono text-(--text-muted)">{block.items.length} задач</span>
      {overdue > 0 && <span className="text-[11px] font-mono text-red-400" title="Просрочено">! {overdue}</span>}
      <div className="w-24"><div className="flex items-center justify-between text-[10px] font-mono mb-1"><span style={{ color: block.user.roleMeta.hex }}>{pct}%</span><span className="text-(--text-muted)">{done}/{block.items.length}</span></div><div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}><motion.div className="h-full rounded-full" style={{ background: block.user.roleMeta.hex }} animate={{ width: `${pct}%` }} /></div></div>
      <button
        type="button"
        aria-controls={panelId}
        aria-expanded={!isCollapsed}
        onClick={onToggle}
        className="cursor-pointer flex h-8 min-w-8 items-center justify-center rounded-xl text-[11px] font-semibold text-(--text-muted) transition-colors hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        style={{ border: "1px solid var(--glass-border)" }}
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
    <div className="min-w-0 rounded-xl overflow-hidden" style={{ background: day.isToday ? "rgba(139,92,246,0.070)" : "rgba(255,255,255,0.016)", border: day.isToday ? "1px solid rgba(139,92,246,0.32)" : "1px solid var(--glass-border)", boxShadow: day.isToday ? "0 0 0 1px rgba(139,92,246,0.08), 0 8px 24px rgba(139,92,246,0.07)" : "none" }}>
      <div className="px-2 py-1.5 flex items-center justify-between gap-1" style={{ borderBottom: "1px solid var(--glass-border)" }}><div className="min-w-0"><p className="text-[11px] font-semibold leading-tight text-(--text-primary)">{day.shortLabel}</p><p className="text-[9px] font-mono leading-tight text-(--text-muted)">{day.isoDate.slice(5)}</p></div><div className="flex items-center gap-1 text-[10px] font-mono"><span className="text-(--text-muted)">{items.length}</span>{day.isToday && <span className="h-1.5 w-1.5 rounded-full bg-violet-400" title="Сегодня" />}{overdue > 0 && <span className="font-bold text-red-400" title="Просрочено">{overdue}</span>}</div></div>
      <div className="p-1.5 flex flex-col gap-1 overscroll-contain" style={{ maxHeight: `${DENSE_DAY_MAX_HEIGHT}px`, overflowY: hasOverflow ? "auto" : "hidden" }}>
        {items.length === 0 ? <div className="h-7 rounded-lg flex items-center justify-center text-[11px] text-(--text-muted)" style={{ border: "1px dashed var(--glass-border)" }}>свободно</div> : items.map((item) => <PersonalPlanItemRow key={item.id} block={block} item={item} day={day} completions={completions} isAdmin={isAdmin} busyId={busyId} onDetails={onDetails} onEditStart={onEditStart} onDelete={onDelete} onToggle={onToggle} />)}
      </div>
    </div>
  );
}

function PersonalPlanItemRow({ block, item, day, completions, isAdmin, busyId, onDetails, onEditStart, onDelete, onToggle }: { block: PersonalPlanUserBlock; item: DbPersonalPlanItem; day: PersonalPlanWeekDate; completions: DbPersonalPlanCompletion[]; isAdmin: boolean; busyId: number | null; onDetails: (task: SelectedTask) => void; onEditStart: (task: SelectedTask) => void; onDelete: (itemId: number) => void; onToggle: (item: DbPersonalPlanItem, completions: DbPersonalPlanCompletion[]) => void }) {
  const state = getPersonalPlanItemState(item, completions);
  const meta = statusMeta[state.status];
  const detailsHint = item.description ? "Есть описание" : "Открыть детали";

  return (
    <motion.article layout className="group relative min-h-[50px] rounded-lg overflow-hidden" style={{ background: state.isCompleted ? "rgba(255,255,255,0.022)" : meta.bg, border: `1px solid ${state.isOverdue ? meta.border : "var(--glass-border)"}`, boxShadow: state.isOverdue ? "0 0 14px rgba(239,68,68,0.12)" : state.isCurrent ? "0 0 12px rgba(56,189,248,0.11)" : "none" }}>
      <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: item.color }} />
      {state.isOverdue && <motion.div className="absolute inset-0 pointer-events-none" animate={{ opacity: [0.13, 0.03, 0.13] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.20), transparent)" }} />}
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-1.5 py-1.5 pl-2 pr-1.5">
          <button type="button" disabled={busyId === item.id} onClick={() => onToggle(item, completions)} aria-label={state.isCompleted ? "Снять отметку выполнения" : "Отметить задачу выполненной"} className="cursor-pointer mt-0.5 h-5 w-5 rounded shrink-0 flex items-center justify-center text-[10px] leading-none transition-all disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={{ background: state.isCompleted ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${state.isCompleted ? "rgba(52,211,153,0.4)" : "var(--glass-border)"}`, color: state.isCompleted ? "#34d399" : "var(--text-muted)" }} title="Отметить выполнение">{state.isCompleted ? "✓" : ""}</button>
          <div className="min-w-0">
            <button type="button" onClick={() => onDetails({ block, day, item })} className="cursor-pointer block w-full rounded-md px-1 py-0.5 text-left transition-colors hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" aria-label={`Открыть сведения: ${item.title}`}>
              <span className="mb-0.5 flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-[9px] font-mono tabular-nums" style={{ color: item.color }}>{item.startTime}–{item.endTime}</span>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
                <span className="truncate text-[9px] font-medium text-(--text-muted)">{meta.label}</span>
                {item.description && <span className="ml-auto shrink-0 rounded px-1 text-[8px] font-semibold text-(--text-muted)" style={{ border: "1px solid var(--glass-border)" }}>i</span>}
              </span>
              <span className="block text-[11px] font-semibold leading-[1.15] text-(--text-primary)" style={twoLineClampStyle}>{item.title}</span>
              <span className="sr-only">{detailsHint}</span>
            </button>
          </div>
          {isAdmin && <div className="col-start-2 ml-1 flex shrink-0 items-center gap-1 opacity-65 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><button type="button" onClick={() => onEditStart({ block, day, item })} aria-label={`Править задачу: ${item.title}`} title="Править" className="cursor-pointer h-5 min-w-5 rounded-md text-[10px] text-(--text-muted) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={{ border: "1px solid var(--glass-border)" }}>✎</button><button type="button" onClick={() => onDelete(item.id)} aria-label={`Удалить задачу: ${item.title}`} title="Удалить" className="cursor-pointer h-5 min-w-5 rounded-md text-[11px] text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400" style={{ border: "1px solid rgba(239,68,68,0.24)" }}>×</button></div>}
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
      className="m-auto w-[min(720px,calc(100vw-24px))] rounded-2xl p-0 text-(--text-primary) shadow-2xl backdrop:bg-slate-950/70 focus-visible:outline-none"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
      aria-labelledby="personal-plan-task-dialog-title"
    >
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: item.color }} />
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-xs font-bold text-white" style={{ background: selectedTask.block.user.roleMeta.hex, boxShadow: `0 0 18px ${selectedTask.block.user.roleMeta.hex}35` }}>{selectedTask.block.user.initials}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: meta.color }}>{meta.label}</p>
              <h3 id="personal-plan-task-dialog-title" className="mt-1 text-lg font-semibold leading-tight text-(--text-primary)">{isEditing ? "Редактирование задачи" : item.title}</h3>
              <p className="mt-1 text-xs text-(--text-muted)">{selectedTask.block.user.name} · {selectedTask.day.label}, {selectedTask.day.isoDate.slice(5)}</p>
            </div>
            <form method="dialog">
              <button type="submit" aria-label="Закрыть сведения о задаче" className="cursor-pointer h-8 w-8 rounded-xl text-sm text-(--text-muted) transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" style={{ border: "1px solid var(--glass-border)" }}>×</button>
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
                <div className="rounded-xl p-2" style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}><dt className="text-[10px] uppercase tracking-widest text-(--text-muted)">Время</dt><dd className="mt-1 font-mono text-(--text-primary)">{item.startTime}–{item.endTime}</dd></div>
                <div className="rounded-xl p-2" style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}><dt className="text-[10px] uppercase tracking-widest text-(--text-muted)">Статус</dt><dd className="mt-1 font-semibold" style={{ color: meta.color }}>{meta.label}</dd></div>
              </dl>

              <section className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--glass-border)" }}>
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

const twoLineClampStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

function chipStyle(active: boolean, color = "#8b5cf6"): CSSProperties {
  return { background: active ? `${color}18` : "var(--glass-01)", color: active ? color : "var(--text-muted)", border: `1px solid ${active ? color + "44" : "var(--glass-border)"}` };
}
