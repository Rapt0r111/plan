"use client";

import { useCallback, useMemo, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { VariableSectionData } from "@/entities/variable/variableRepository";
import type { VariableDutySlot, VariableLeaveStatus, VariableLeaveType } from "@/shared/db/schema";

const DUTY_SLOTS: Array<{ key: VariableDutySlot; label: string; short: string }> = [
  { key: "day_orderly_1", label: "Дневальный 1", short: "Д1" },
  { key: "day_orderly_2", label: "Дневальный 2", short: "Д2" },
  { key: "duty_officer", label: "Дежурный", short: "ДЖ" },
];

const LEAVE_LABELS: Record<VariableLeaveType, string> = {
  day: "Дневной увал",
  daily: "Суточный увал",
  vacation: "Отпуск",
};

const STATUS_LABELS: Record<VariableLeaveStatus, string> = {
  pending: "На рассмотрении",
  approved: "Одобрено",
  rejected: "Отклонено",
};

interface Props {
  data: VariableSectionData;
  isAdmin: boolean;
  currentProfileId: number | null;
}

type Tab = "tasks" | "leave" | "duty";
type DutyAssignments = VariableSectionData["dutyAssignments"];
type IconProps = { className?: string };

export function VariablePageClient({ data, isAdmin, currentProfileId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("tasks");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const defaultProfileId = currentProfileId ?? data.variableUsers[0]?.id ?? 0;

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  const postJson = useCallback(async (url: string, method: string, payload: unknown) => {
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const message = await res.text();
      setError(message || "Не удалось сохранить изменения");
      throw new Error(message);
    }
    refresh();
  }, [refresh]);

  const handleDateFilter = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const date = String(new FormData(event.currentTarget).get("date") ?? data.selectedDate);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.push(`/variable?${params.toString()}`);
  }, [data.selectedDate, router, searchParams]);

  const handleDailyTask = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/variable/daily-tasks", "POST", {
      profileUserId: Number(form.get("profileUserId") ?? defaultProfileId),
      taskDate: String(form.get("taskDate") ?? data.tomorrowDate),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
    });
    event.currentTarget.reset();
  }, [data.tomorrowDate, defaultProfileId, postJson]);

  const handleLeave = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/variable/leave-requests", "POST", {
      profileUserId: Number(form.get("profileUserId") ?? defaultProfileId),
      leaveType: String(form.get("leaveType") ?? "day"),
      dateFrom: String(form.get("dateFrom") ?? data.tomorrowDate),
      dateTo: String(form.get("dateTo") ?? data.tomorrowDate),
      comment: String(form.get("comment") ?? ""),
    });
    event.currentTarget.reset();
  }, [data.tomorrowDate, defaultProfileId, postJson]);

  const handleDuty = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/variable/duty-schedule", "PUT", {
      dutyDate: String(form.get("dutyDate") ?? data.tomorrowDate),
      slots: {
        day_orderly_1: Number(form.get("day_orderly_1")),
        day_orderly_2: Number(form.get("day_orderly_2")),
        duty_officer: Number(form.get("duty_officer")),
      },
    });
  }, [data.tomorrowDate, postJson]);

  const reviewLeave = useCallback((id: number, status: "approved" | "rejected") => {
    void postJson(`/api/variable/leave-requests/${id}`, "PATCH", { status }).catch(() => undefined);
  }, [postJson]);

  const toggleDailyTask = useCallback((id: number, status: "todo" | "done") => {
    void postJson(`/api/variable/daily-tasks/${id}`, "PATCH", { status }).catch(() => undefined);
  }, [postJson]);

  const groupedDuty = useMemo(() => {
    const byDate = new Map<string, DutyAssignments>();
    for (const entry of data.dutyAssignments) {
      const bucket = byDate.get(entry.dutyDate) ?? [];
      bucket.push(entry);
      byDate.set(entry.dutyDate, bucket);
    }
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [data.dutyAssignments]);

  const stats = useMemo(() => {
    const todayTasks = data.dailyTasks.filter((task) => task.taskDate === data.todayDate).length;
    const tomorrowTasks = data.dailyTasks.filter((task) => task.taskDate === data.tomorrowDate).length;
    const doneTasks = data.dailyTasks.filter((task) => task.status === "done").length;
    const pendingLeaves = data.leaveRequests.filter((request) => request.status === "pending").length;
    const tomorrowDuty = data.dutyAssignments.filter((entry) => entry.dutyDate === data.tomorrowDate).length;

    return {
      todayTasks,
      tomorrowTasks,
      doneTasks,
      pendingLeaves,
      tomorrowDuty,
      completion: data.dailyTasks.length ? Math.round((doneTasks / data.dailyTasks.length) * 100) : 0,
    };
  }, [data.dailyTasks, data.dutyAssignments, data.leaveRequests, data.todayDate, data.tomorrowDate]);

  const taskBuckets = useMemo(() => ({
    today: data.dailyTasks.filter((task) => task.taskDate === data.todayDate),
    tomorrow: data.dailyTasks.filter((task) => task.taskDate === data.tomorrowDate),
    selected: data.dailyTasks.filter((task) => task.taskDate === data.selectedDate),
  }), [data.dailyTasks, data.selectedDate, data.todayDate, data.tomorrowDate]);

  const selectedDateMatchesToday = data.selectedDate === data.todayDate;
  const selectedDateMatchesTomorrow = data.selectedDate === data.tomorrowDate;

  const tabs = useMemo<Array<{ key: Tab; label: string; hint: string; count: number; icon: (props: IconProps) => ReactNode }>>(() => [
    { key: "tasks", label: "Задачи", hint: "сегодня, завтра и дата", count: data.dailyTasks.length, icon: TaskIcon },
    { key: "leave", label: "Увал", hint: "заявки и решения", count: data.leaveRequests.length, icon: LeaveIcon },
    { key: "duty", label: "Наряды", hint: "2 дневальных + дежурный", count: groupedDuty.length, icon: DutyIcon },
  ], [data.dailyTasks.length, data.leaveRequests.length, groupedDuty.length]);

  return (
    <main className="flex-1 overflow-y-auto p-3 lg:p-5" style={{ opacity: isPending ? 0.72 : 1, transition: "opacity 180ms ease-out" }}>
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="relative overflow-hidden rounded-[28px] p-4 lg:p-5" style={heroStyle}>
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusPill tone="info"><ShieldIcon className="h-3.5 w-3.5" /> {isAdmin ? "Администрирование" : "Личный режим"}</StatusPill>
                <StatusPill tone="muted"><CalendarIcon className="h-3.5 w-3.5" /> Завтра: {data.tomorrowDate}</StatusPill>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-(--text-primary) lg:text-2xl">Контур переменного состава</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-(--text-secondary)">
                Единое место для задач на следующий день, заявок в увал и расписания суточных нарядов. История открывается фильтром периода, изменения синхронизируются через серверные события.
              </p>
            </div>

            <form onSubmit={handleDateFilter} className="rounded-2xl p-3" style={filterStyle}>
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-(--text-muted)">
                <CalendarIcon className="h-4 w-4" /> История с даты
              </label>
              <div className="flex gap-2">
                <input name="date" type="date" defaultValue={data.selectedDate} className={inputClassName} style={inputStyle} />
                <button disabled={isPending} className="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={primaryButtonStyle}>Показать</button>
              </div>
            </form>

            <div className="xl:col-span-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Задач на завтра" value={stats.tomorrowTasks} accent="#38bdf8" icon={<TaskIcon className="h-4 w-4" />} />
              <MetricCard label="Выполнено в периоде" value={`${stats.completion}%`} accent="#34d399" icon={<CheckIcon className="h-4 w-4" />} />
              <MetricCard label="Заявок ждут решения" value={stats.pendingLeaves} accent="#fbbf24" icon={<LeaveIcon className="h-4 w-4" />} />
              <MetricCard label="Нарядов на завтра" value={`${stats.tomorrowDuty}/3`} accent="#a78bfa" icon={<DutyIcon className="h-4 w-4" />} />
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl px-4 py-3 text-sm" style={errorBannerStyle} role="alert">
            <div className="flex items-start gap-2">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">{error}</span>
            </div>
          </div>
        )}

        <section className="grid gap-2 lg:grid-cols-3" aria-label="Разделы переменного состава">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className="group cursor-pointer rounded-2xl p-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                style={active ? activeTabCardStyle : tabCardStyle}
                aria-pressed={active}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={active ? activeIconBoxStyle : iconBoxStyle}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-(--text-primary)">{item.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-(--text-muted)">{item.hint}</span>
                    </span>
                  </span>
                  <span className="rounded-lg px-2 py-1 text-xs font-mono" style={active ? activeCountStyle : mutedBadgeStyle}>{item.count}</span>
                </span>
              </button>
            );
          })}
        </section>

        {tab === "tasks" && (
          <section className="grid gap-4 xl:grid-cols-[minmax(340px,0.76fr)_minmax(0,1.24fr)]">
            <Panel title="Постановка задачи" subtitle="Можно поставить задачу на сегодня, завтра или на любую выбранную дату." icon={<TaskIcon className="h-4 w-4" />} accent="#38bdf8">
              <form onSubmit={handleDailyTask} className="space-y-3 p-4">
                <UserSelect users={data.variableUsers} isAdmin={isAdmin} currentProfileId={defaultProfileId} />
                <Field label="Дата задачи"><input name="taskDate" type="date" defaultValue={data.todayDate} className={inputClassName} style={inputStyle} /></Field>
                <Field label="Задача"><input name="title" required maxLength={200} placeholder="Что нужно сделать" className={inputClassName} style={inputStyle} /></Field>
                <Field label="Комментарий"><textarea name="description" rows={4} placeholder="Детали, место, ограничение по времени" className={inputClassName} style={inputStyle} /></Field>
                <button disabled={isPending} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={primaryButtonStyle}>Добавить задачу</button>
              </form>
            </Panel>

            <Panel title="Задачи по датам" subtitle="Основной блок — на сегодня. Отдельно видны завтра и выбранная дата." icon={<CalendarIcon className="h-4 w-4" />} accent="#34d399">
              <div className="grid gap-3 p-3">
                <TaskDateSection
                  title="Сегодня"
                  subtitle={data.todayDate}
                  accent="#38bdf8"
                  tasks={taskBuckets.today}
                  emptyText="На сегодня задач нет."
                  isPending={isPending}
                  onToggle={toggleDailyTask}
                />
                <TaskDateSection
                  title="Завтра"
                  subtitle={data.tomorrowDate}
                  accent="#22c55e"
                  tasks={taskBuckets.tomorrow}
                  emptyText="На завтра задач нет."
                  isPending={isPending}
                  onToggle={toggleDailyTask}
                />
                <div className="rounded-2xl p-3" style={subPanelStyle}>
                  <form onSubmit={handleDateFilter} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <Field label="Выбрать дату">
                      <input name="date" type="date" defaultValue={data.selectedDate} className={inputClassName} style={inputStyle} />
                    </Field>
                    <button disabled={isPending} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={primaryButtonStyle}>Показать дату</button>
                  </form>
                </div>
                {!selectedDateMatchesToday && !selectedDateMatchesTomorrow && (
                  <TaskDateSection
                    title="Выбранная дата"
                    subtitle={data.selectedDate}
                    accent="#fbbf24"
                    tasks={taskBuckets.selected}
                    emptyText="На выбранную дату задач нет."
                    isPending={isPending}
                    onToggle={toggleDailyTask}
                  />
                )}
              </div>
            </Panel>
          </section>
        )}

        {tab === "leave" && (
          <section className="grid gap-4 xl:grid-cols-[minmax(340px,0.76fr)_minmax(0,1.24fr)]">
            <Panel title="Заявка в увал" subtitle="Дневной, суточный или отпуск с выбором периода." icon={<LeaveIcon className="h-4 w-4" />} accent="#fbbf24">
              <form onSubmit={handleLeave} className="space-y-3 p-4">
                <UserSelect users={data.variableUsers} isAdmin={isAdmin} currentProfileId={defaultProfileId} />
              <Field label="Тип увала">
                  <div className="relative">
                    <select name="leaveType" defaultValue="day" className={`${inputClassName} pr-10`} style={selectStyle}>
                      {Object.entries(LEAVE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-muted)" />
                  </div>
                </Field>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="С даты"><input name="dateFrom" type="date" defaultValue={data.tomorrowDate} className={inputClassName} style={inputStyle} /></Field>
                  <Field label="По дату"><input name="dateTo" type="date" defaultValue={data.tomorrowDate} className={inputClassName} style={inputStyle} /></Field>
                </div>
                <Field label="Комментарий"><textarea name="comment" rows={4} placeholder="Причина, маршрут, дополнительные условия" className={inputClassName} style={inputStyle} /></Field>
                <button disabled={isPending} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={primaryButtonStyle}>Отправить заявку</button>
              </form>
            </Panel>

            <Panel title="Заявки" subtitle="Статусы видны сразу; администратор может принять решение." icon={<ShieldIcon className="h-4 w-4" />} accent="#a78bfa">
              <div className="grid gap-2 p-3">
                {data.leaveRequests.length === 0 ? <Empty text="Заявок за выбранный период нет." /> : data.leaveRequests.map((request) => (
                  <article key={request.id} className="rounded-2xl p-3" style={rowCardStyle}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-(--text-primary)">{LEAVE_LABELS[request.leaveType]}</p>
                          <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={leaveBadgeStyle(request.status)}>{STATUS_LABELS[request.status]}</span>
                        </div>
                        <p className="mt-1 text-xs text-(--text-muted)">{request.profile.name} · {request.dateFrom} — {request.dateTo}</p>
                        {request.comment && <p className="mt-2 text-xs leading-5 text-(--text-secondary)">{request.comment}</p>}
                      </div>
                      {isAdmin && request.status === "pending" && (
                        <div className="flex shrink-0 gap-2">
                          <button type="button" disabled={isPending} onClick={() => reviewLeave(request.id, "approved")} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={successButtonStyle}>Одобрить</button>
                          <button type="button" disabled={isPending} onClick={() => reviewLeave(request.id, "rejected")} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={dangerButtonStyle}>Отклонить</button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {tab === "duty" && (
          <section className={isAdmin ? "grid gap-4 xl:grid-cols-[minmax(340px,0.76fr)_minmax(0,1.24fr)]" : "grid gap-4"}>
            {isAdmin && (
              <Panel title="Назначить наряд" subtitle="На дату нужно выбрать двух дневальных и одного дежурного." icon={<DutyIcon className="h-4 w-4" />} accent="#a78bfa">
                <form onSubmit={handleDuty} className="space-y-3 p-4">
                  <Field label="Дата наряда"><input name="dutyDate" type="date" defaultValue={data.tomorrowDate} className={inputClassName} style={inputStyle} /></Field>
                  {DUTY_SLOTS.map((slot) => (
                    <Field key={slot.key} label={slot.label}>
                      <div className="relative">
                        <select name={slot.key} required defaultValue="" className={`${inputClassName} pr-10`} style={selectStyle}>
                          <option value="" disabled>Выберите человека</option>
                          {data.variableUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-muted)" />
                      </div>
                    </Field>
                  ))}
                  <button disabled={isPending} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={primaryButtonStyle}>Сохранить наряд</button>
                </form>
              </Panel>
            )}

            <Panel title="Расписание нарядов" subtitle="2 дневальных и 1 дежурный на каждые сутки." icon={<CalendarIcon className="h-4 w-4" />} accent="#34d399">
              <div className="grid gap-2 p-3">
                {groupedDuty.length === 0 ? <Empty text="Нарядов за выбранный период нет." /> : groupedDuty.map(([date, entries]) => (
                  <article key={date} className="rounded-2xl p-3" style={rowCardStyle}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-(--text-primary)">{date}</p>
                      <span className="rounded-lg px-2 py-1 text-xs font-mono" style={entries.length === 3 ? successBadgeStyle : mutedBadgeStyle}>{entries.length}/3</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {DUTY_SLOTS.map((slot) => {
                        const entry = entries.find((item) => item.slot === slot.key);
                        return (
                          <div key={slot.key} className="rounded-xl px-3 py-2" style={dutySlotStyle}>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[11px] font-semibold text-(--text-muted)">{slot.label}</p>
                              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono" style={mutedBadgeStyle}>{slot.short}</span>
                            </div>
                            <p className="text-sm font-semibold text-(--text-primary)">{entry?.user.name ?? "Не назначен"}</p>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        )}
      </div>
    </main>
  );
}

function UserSelect({ users, isAdmin, currentProfileId }: { users: VariableSectionData["variableUsers"]; isAdmin: boolean; currentProfileId: number }) {
  if (!isAdmin) return <input type="hidden" name="profileUserId" value={currentProfileId} />;
  return (
    <Field label="Военнослужащий">
      <div className="relative">
        <select name="profileUserId" defaultValue={currentProfileId} className={`${inputClassName} pr-10`} style={selectStyle}>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-muted)" />
      </div>
    </Field>
  );
}

function Panel({ title, subtitle, children, icon, accent }: { title: string; subtitle: string; children: ReactNode; icon: ReactNode; accent: string }) {
  return (
    <section className="overflow-hidden rounded-2xl" style={panelStyle}>
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--glass-border)", background: `linear-gradient(90deg, ${accent}18, transparent 62%)` }}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}18`, border: `1px solid ${accent}45`, color: accent }}>
            {icon}
          </span>
          <span className="min-w-0">
            <h2 className="text-sm font-semibold text-(--text-primary)">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-(--text-muted)">{subtitle}</p>
          </span>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-(--text-secondary)">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value, accent, icon }: { label: string; value: number | string; accent: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl p-3" style={metricStyle}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-(--text-muted)">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${accent}18`, border: `1px solid ${accent}42`, color: accent }}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold font-mono" style={{ color: accent }}>{value}</p>
    </div>
  );
}

function StatusPill({ children, tone }: { children: ReactNode; tone: "info" | "muted" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={tone === "info" ? infoPillStyle : mutedBadgeStyle}>
      {children}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl p-5 text-center" style={emptyStyle}>
      <p className="text-sm font-medium text-(--text-secondary)">{text}</p>
      <p className="mt-1 text-xs text-(--text-muted)">Измените дату просмотра или добавьте новую запись.</p>
    </div>
  );
}

function TaskDateSection({
  title,
  subtitle,
  accent,
  tasks,
  emptyText,
  isPending,
  onToggle,
}: {
  title: string;
  subtitle: string;
  accent: string;
  tasks: VariableSectionData["dailyTasks"];
  emptyText: string;
  isPending: boolean;
  onToggle: (id: number, status: "todo" | "done") => void;
}) {
  return (
    <section className="rounded-2xl p-3" style={subPanelStyle}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-(--text-primary)">{title}</p>
          <p className="mt-1 text-xs text-(--text-muted)">{subtitle}</p>
        </div>
        <span className="rounded-lg px-2 py-1 text-xs font-mono" style={{ ...mutedBadgeStyle, color: accent, borderColor: `${accent}50` }}>{tasks.length}</span>
      </div>
      <div className="grid gap-2">
        {tasks.length === 0 ? <Empty text={emptyText} /> : tasks.map((task) => (
          <TaskRow key={task.id} task={task} isPending={isPending} onToggle={onToggle} />
        ))}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  isPending,
  onToggle,
}: {
  task: VariableSectionData["dailyTasks"][number];
  isPending: boolean;
  onToggle: (id: number, status: "todo" | "done") => void;
}) {
  return (
    <article className="rounded-2xl p-3 transition-colors hover:bg-white/[0.025]" style={rowCardStyle}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: task.status === "done" ? "#34d399" : "#38bdf8" }} />
            <p className="min-w-0 text-sm font-semibold text-(--text-primary)">{task.title}</p>
          </div>
          <p className="mt-1 text-xs text-(--text-muted)">{task.profile.name}</p>
          {task.description && <p className="mt-2 text-xs leading-5 text-(--text-secondary)">{task.description}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-lg px-2 py-1 text-xs font-mono" style={task.status === "done" ? successBadgeStyle : mutedBadgeStyle }>{task.status === "done" ? "готово" : "план"}</span>
          <button type="button" disabled={isPending} onClick={() => onToggle(task.id, task.status === "done" ? "todo" : "done")} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={task.status === "done" ? mutedButtonStyle : successButtonStyle}>
            {task.status === "done" ? "Вернуть" : "Готово"}
          </button>
        </div>
      </div>
    </article>
  );
}

function leaveBadgeStyle(status: VariableLeaveStatus): CSSProperties {
  if (status === "approved") return successBadgeStyle;
  if (status === "rejected") return dangerBadgeStyle;
  return warningBadgeStyle;
}

function TaskIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4.5h8" /><path d="M6 10h8" /><path d="M6 15.5h5" /><rect x="2.5" y="2.5" width="15" height="15" rx="3" /></svg>;
}

function LeaveIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15.5c3.5-1 7.7-5.3 10.5-11" /><path d="M5.5 6.5c3.6-.4 6.5.7 9 3.5" /><path d="M4 15.5h9.5" /></svg>;
}

function DutyIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2.5 16 5v4.5c0 3.7-2.4 6.8-6 8-3.6-1.2-6-4.3-6-8V5l6-2.5Z" /><path d="M7.5 10.2 9.2 12l3.5-4" /></svg>;
}

function CalendarIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="14" height="13" rx="2.5" /><path d="M7 2.5v3M13 2.5v3M3.5 8h13" /></svg>;
}

function CheckIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 10.5 8.2 14l7.3-8" /></svg>;
}

function ShieldIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2.5 16.5 5v5.2c0 3.4-2.6 6.2-6.5 7.3-3.9-1.1-6.5-3.9-6.5-7.3V5L10 2.5Z" /><path d="M7.5 10h5" /></svg>;
}

function AlertIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3 18 17H2L10 3Z" /><path d="M10 8v4" /><path d="M10 15h.01" /></svg>;
}

function ChevronDownIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5.5 7.5 4.5 5 4.5-5" /></svg>;
}

const inputClassName = "w-full rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 [color-scheme:dark]";

const heroStyle: CSSProperties = {
  background: "radial-gradient(circle at 8% 10%, rgba(56,189,248,0.16), transparent 30%), radial-gradient(circle at 92% 8%, rgba(34,197,94,0.14), transparent 28%), linear-gradient(135deg, rgba(15,23,42,0.92), rgba(2,6,23,0.34))",
  border: "1px solid var(--glass-border)",
  boxShadow: "var(--shadow-card)",
};
const panelStyle: CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" };
const subPanelStyle: CSSProperties = { background: "rgba(15,23,42,0.32)", border: "1px solid var(--glass-border)" };
const rowCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008))", border: "1px solid var(--glass-border)", contentVisibility: "auto", containIntrinsicSize: "180px" };
const filterStyle: CSSProperties = { background: "rgba(15,23,42,0.48)", border: "1px solid var(--glass-border)" };
const metricStyle: CSSProperties = { background: "rgba(15,23,42,0.42)", border: "1px solid var(--glass-border)", contentVisibility: "auto", containIntrinsicSize: "96px" };
const inputStyle: CSSProperties = { background: "rgba(15,23,42,0.72)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", colorScheme: "dark" };
const selectStyle: CSSProperties = { ...inputStyle, paddingRight: "2.5rem", WebkitAppearance: "none", appearance: "none" };
const primaryButtonStyle: CSSProperties = { background: "rgba(34,197,94,0.16)", border: "1px solid rgba(34,197,94,0.34)", color: "#34d399" };
const mutedButtonStyle: CSSProperties = { background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" };
const successButtonStyle: CSSProperties = { background: "rgba(52,211,153,0.13)", border: "1px solid rgba(52,211,153,0.30)", color: "#34d399" };
const dangerButtonStyle: CSSProperties = { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", color: "#f87171" };
const tabCardStyle: CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" };
const activeTabCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(56,189,248,0.08))", border: "1px solid rgba(52,211,153,0.34)", boxShadow: "0 18px 42px rgba(34,197,94,0.08)" };
const iconBoxStyle: CSSProperties = { background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" };
const activeIconBoxStyle: CSSProperties = { background: "rgba(34,197,94,0.14)", border: "1px solid rgba(52,211,153,0.34)", color: "#34d399" };
const activeCountStyle: CSSProperties = { background: "rgba(34,197,94,0.14)", border: "1px solid rgba(52,211,153,0.34)", color: "#34d399" };
const mutedBadgeStyle: CSSProperties = { background: "rgba(148,163,184,0.12)", border: "1px solid rgba(148,163,184,0.25)", color: "#94a3b8" };
const successBadgeStyle: CSSProperties = { background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.28)", color: "#34d399" };
const dangerBadgeStyle: CSSProperties = { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", color: "#f87171" };
const warningBadgeStyle: CSSProperties = { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)", color: "#fbbf24" };
const infoPillStyle: CSSProperties = { background: "rgba(56,189,248,0.11)", border: "1px solid rgba(56,189,248,0.26)", color: "#38bdf8" };
const dutySlotStyle: CSSProperties = { background: "var(--glass-01)", border: "1px solid var(--glass-border)" };
const emptyStyle: CSSProperties = { background: "rgba(148,163,184,0.07)", border: "1px dashed rgba(148,163,184,0.24)" };
const errorBannerStyle: CSSProperties = { background: "rgba(239,68,68,0.11)", border: "1px solid rgba(239,68,68,0.28)", color: "#fca5a5" };
