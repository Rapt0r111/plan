"use client";

import { memo, useCallback, useMemo, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode, type SelectHTMLAttributes } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { VariableSectionData } from "@/entities/variable/variableRepository";
import type { VariableDutySlot, VariableLeaveStatus, VariableLeaveType } from "@/shared/db/schema";

const DUTY_SLOTS: Array<{ key: VariableDutySlot; label: string; short: string }> = [
  { key: "day_orderly_1", label: "Дневальный 1", short: "Д1" },
  { key: "day_orderly_2", label: "Дневальный 2", short: "Д2" },
  { key: "duty_officer", label: "Дежурный", short: "ДЖ" },
];

const WORK_GROUP_SLOTS: Array<{ key: VariableDutySlot; label: string; short: string }> = [
  { key: "day_rg", label: "Дневное РГ", short: "ДРГ" },
  { key: "night_rg", label: "Ночное РГ", short: "НРГ" },
  { key: "info_rg", label: "Информационное РГ", short: "ИРГ" },
];

const LEAVE_LABELS: Record<VariableLeaveType, string> = {
  day: "Дневное увольнение",
  daily: "Суточное увольнение",
  vacation: "Отпуск",
};

const STATUS_LABELS: Record<VariableLeaveStatus, string> = {
  pending: "На рассмотрении",
  approved: "Одобрено",
  rejected: "Отклонено",
  revoked: "Отозвано",
};

interface Props {
  data: VariableSectionData;
  isAdmin: boolean;
  currentProfileId: number | null;
}

type Tab = "tasks" | "leave" | "duty";
type LeaveTab = "thirty" | "future" | "past";
type DutyTab = "planned" | "past";
type DutyPeriod = "week" | "month" | "nextMonth" | "year";
type DutyAssignments = VariableSectionData["dutyAssignments"];
type IconProps = { className?: string };

export function VariablePageClient({ data, isAdmin, currentProfileId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("tasks");
  const [leaveTab, setLeaveTab] = useState<LeaveTab>("thirty");
  const [dutyTab, setDutyTab] = useState<DutyTab>("planned");
  const [dutyPeriod, setDutyPeriod] = useState<DutyPeriod>("week");
  const [leavePersonFilter, setLeavePersonFilter] = useState("all");
  const [leaveDateFilter, setLeaveDateFilter] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
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
      taskDate: String(form.get("taskDate") ?? data.todayDate),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
    });
    event.currentTarget.reset();
  }, [data.todayDate, defaultProfileId, postJson]);

  const handleTaskEdit = useCallback(async (event: FormEvent<HTMLFormElement>, id: number) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson(`/api/variable/daily-tasks/${id}`, "PATCH", {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
    });
    setEditingTaskId(null);
  }, [postJson]);

  const handleLeave = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/variable/leave-requests", "POST", {
      profileUserId: Number(form.get("profileUserId") ?? defaultProfileId),
      leaveType: String(form.get("leaveType") ?? "day"),
      dateFrom: String(form.get("dateFrom") ?? data.tomorrowDate),
      dateTo: String(form.get("dateTo") ?? data.tomorrowDate),
      departureTime: emptyToNull(form.get("departureTime")),
      arrivalTime: emptyToNull(form.get("arrivalTime")),
      comment: String(form.get("comment") ?? ""),
    });
    event.currentTarget.reset();
  }, [data.tomorrowDate, defaultProfileId, postJson]);

  const handleDuty = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/variable/duty-schedule", "PUT", {
      scheduleType: "daily",
      dutyDate: String(form.get("dutyDate") ?? data.tomorrowDate),
      slots: {
        day_orderly_1: Number(form.get("day_orderly_1")),
        day_orderly_2: Number(form.get("day_orderly_2")),
        duty_officer: Number(form.get("duty_officer")),
      },
    });
  }, [data.tomorrowDate, postJson]);

  const handleWorkGroupDuty = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/variable/duty-schedule", "PUT", {
      scheduleType: "work_group",
      dateFrom: String(form.get("dateFrom") ?? data.todayDate),
      dateTo: String(form.get("dateTo") ?? data.todayDate),
      slots: {
        day_rg: Number(form.get("day_rg")),
        night_rg: Number(form.get("night_rg")),
        info_rg: Number(form.get("info_rg")),
      },
    });
  }, [data.todayDate, postJson]);

  const reviewLeave = useCallback((id: number, status: "approved" | "rejected" | "revoked") => {
    void postJson(`/api/variable/leave-requests/${id}`, "PATCH", { status }).catch(() => undefined);
  }, [postJson]);

  const toggleDailyTask = useCallback((id: number, status: "todo" | "done") => {
    void postJson(`/api/variable/daily-tasks/${id}`, "PATCH", { status }).catch(() => undefined);
  }, [postJson]);

  const deleteDailyTask = useCallback((id: number) => {
    void postJson(`/api/variable/daily-tasks/${id}`, "DELETE", null).catch(() => undefined);
  }, [postJson]);

  const handleMonthChange = useCallback((month: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", month);
    router.push(`/variable?${params.toString()}`);
  }, [router, searchParams]);

  const monthDays = useMemo(() => getMonthCalendarDays(data.selectedMonth), [data.selectedMonth]);

  const normalDuties = useMemo(
    () => data.dutyAssignments.filter((entry) => DUTY_SLOTS.some((slot) => slot.key === entry.slot)),
    [data.dutyAssignments],
  );

  const workGroupDuties = useMemo(
    () => data.dutyAssignments.filter((entry) => WORK_GROUP_SLOTS.some((slot) => slot.key === entry.slot)),
    [data.dutyAssignments],
  );

  const plannedDutyRows = useMemo(() => {
    const [dateFrom, dateTo] = getDutyPeriodRange(dutyPeriod, data.todayDate);
    return normalDuties.filter((entry) => entry.dateTo >= dateFrom && entry.dateFrom <= dateTo).sort(sortDuty);
  }, [data.todayDate, dutyPeriod, normalDuties]);

  const pastDutyRows = useMemo(() => normalDuties.filter((entry) => entry.dateTo < data.todayDate).sort(sortDuty), [data.todayDate, normalDuties]);
  const visibleDutyRows = dutyTab === "past" ? pastDutyRows : plannedDutyRows;
  const groupedDuty = useMemo(() => groupDutyByDate(visibleDutyRows), [visibleDutyRows]);
  const groupedWorkDuty = useMemo(() => groupDutyByDate(workGroupDuties.sort(sortDuty)), [workGroupDuties]);

  const leaveCalendarRows = useMemo(() => {
    const [monthFrom, monthTo] = getMonthRange(data.selectedMonth);
    return data.leaveRequests
      .filter((request) => request.dateFrom <= monthTo && request.dateTo >= monthFrom)
      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom) || a.profile.name.localeCompare(b.profile.name));
  }, [data.leaveRequests, data.selectedMonth]);

  const dutyCalendarRows = useMemo(() => {
    const [monthFrom, monthTo] = getMonthRange(data.selectedMonth);
    return data.dutyAssignments
      .filter((entry) => entry.dateFrom <= monthTo && entry.dateTo >= monthFrom)
      .sort(sortDuty);
  }, [data.dutyAssignments, data.selectedMonth]);

  const leaveCalendarByDay = useMemo(
    () => buildLeaveCalendarByDay(monthDays, leaveCalendarRows),
    [leaveCalendarRows, monthDays],
  );

  const dutyCalendarByDay = useMemo(
    () => buildDutyCalendarByDay(monthDays, dutyCalendarRows),
    [dutyCalendarRows, monthDays],
  );

  const leaveRows = useMemo(() => {
    const thirtyEnd = addDateDays(data.todayDate, 29);
    return data.leaveRequests
      .filter((request) => {
        if (leavePersonFilter !== "all" && request.profileUserId !== Number(leavePersonFilter)) return false;
        if (leaveDateFilter && !(request.dateFrom <= leaveDateFilter && request.dateTo >= leaveDateFilter)) return false;
        if (leaveTab === "thirty") return request.dateTo >= data.todayDate && request.dateFrom <= thirtyEnd;
        if (leaveTab === "future") return request.dateFrom > thirtyEnd;
        return request.dateTo < data.todayDate;
      })
      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom) || a.profile.name.localeCompare(b.profile.name));
  }, [data.leaveRequests, data.todayDate, leaveDateFilter, leavePersonFilter, leaveTab]);

  const stats = useMemo(() => {
    const todayTasks = data.dailyTasks.filter((task) => task.taskDate === data.todayDate).length;
    const tomorrowTasks = data.dailyTasks.filter((task) => task.taskDate === data.tomorrowDate).length;
    const doneTasks = data.dailyTasks.filter((task) => task.status === "done").length;
    const pendingLeaves = data.leaveRequests.filter((request) => request.status === "pending").length;
    const plannedDuties = plannedDutyRows.length;

    return {
      todayTasks,
      tomorrowTasks,
      doneTasks,
      pendingLeaves,
      plannedDuties,
      completion: data.dailyTasks.length ? Math.round((doneTasks / data.dailyTasks.length) * 100) : 0,
    };
  }, [data.dailyTasks, data.leaveRequests, data.todayDate, data.tomorrowDate, plannedDutyRows.length]);

  const taskBuckets = useMemo(() => ({
    today: data.dailyTasks.filter((task) => task.taskDate === data.todayDate),
    tomorrow: data.dailyTasks.filter((task) => task.taskDate === data.tomorrowDate),
    selected: data.dailyTasks.filter((task) => task.taskDate === data.selectedDate),
  }), [data.dailyTasks, data.selectedDate, data.todayDate, data.tomorrowDate]);

  const selectedDateMatchesToday = data.selectedDate === data.todayDate;
  const selectedDateMatchesTomorrow = data.selectedDate === data.tomorrowDate;

  const tabs = useMemo<Array<{ key: Tab; label: string; hint: string; count: number; icon: (props: IconProps) => ReactNode }>>(() => [
    { key: "tasks", label: "Задачи", hint: "сегодня, завтра и дата", count: data.dailyTasks.length, icon: TaskIcon },
    { key: "leave", label: "Увольнение", hint: "заявки и решения", count: data.leaveRequests.length, icon: LeaveIcon },
    { key: "duty", label: "Наряды", hint: "суточные + рабочая группа", count: groupedDuty.length + groupedWorkDuty.length, icon: DutyIcon },
  ], [data.dailyTasks.length, data.leaveRequests.length, groupedDuty.length, groupedWorkDuty.length]);

  return (
    <main className="flex-1 overflow-y-auto p-3 lg:p-5" style={pageShellStyle} aria-busy={isPending}>
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="relative overflow-hidden rounded-[28px] p-4 lg:p-5" style={heroStyle}>
          <div className="pointer-events-none absolute -right-24 -top-28 hidden h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl lg:block" />
          <div className="pointer-events-none absolute -left-24 bottom-0 hidden h-64 w-64 rounded-full bg-sky-400/10 blur-3xl lg:block" />
          <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusPill tone="info"><ShieldIcon className="h-3.5 w-3.5" /> {isAdmin ? "Администрирование" : "Личный режим"}</StatusPill>
                <StatusPill tone="muted"><CalendarIcon className="h-3.5 w-3.5" /> Завтра: {data.tomorrowDate}</StatusPill>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-(--text-primary) lg:text-2xl">Контур переменного состава</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-(--text-secondary)">
                Единое место для задач на следующий день, заявок в увольнение и расписания суточных нарядов. История открывается фильтром периода, изменения синхронизируются через серверные события.
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
              <MetricCard label="Задач сегодня" value={stats.todayTasks} accent="#38bdf8" icon={<TaskIcon className="h-4 w-4" />} />
              <MetricCard label="Выполнено в периоде" value={`${stats.completion}%`} accent="#34d399" icon={<CheckIcon className="h-4 w-4" />} />
              <MetricCard label="Заявок ждут решения" value={stats.pendingLeaves} accent="#fbbf24" icon={<LeaveIcon className="h-4 w-4" />} />
              <MetricCard label="Плановых нарядов" value={stats.plannedDuties} accent="#a78bfa" icon={<DutyIcon className="h-4 w-4" />} />
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
                <Field label="Дата задачи"><input name="taskDate" type="date" min={data.todayDate} defaultValue={data.todayDate} className={inputClassName} style={inputStyle} /></Field>
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
                  isAdmin={isAdmin}
                  currentProfileId={currentProfileId}
                  todayDate={data.todayDate}
                  editingTaskId={editingTaskId}
                  onToggle={toggleDailyTask}
                  onDelete={deleteDailyTask}
                  onEdit={setEditingTaskId}
                  onSubmitEdit={handleTaskEdit}
                />
                <TaskDateSection
                  title="Завтра"
                  subtitle={data.tomorrowDate}
                  accent="#22c55e"
                  tasks={taskBuckets.tomorrow}
                  emptyText="На завтра задач нет."
                  isPending={isPending}
                  isAdmin={isAdmin}
                  currentProfileId={currentProfileId}
                  todayDate={data.todayDate}
                  editingTaskId={editingTaskId}
                  onToggle={toggleDailyTask}
                  onDelete={deleteDailyTask}
                  onEdit={setEditingTaskId}
                  onSubmitEdit={handleTaskEdit}
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
                    isAdmin={isAdmin}
                    currentProfileId={currentProfileId}
                    todayDate={data.todayDate}
                    editingTaskId={editingTaskId}
                    onToggle={toggleDailyTask}
                    onDelete={deleteDailyTask}
                    onEdit={setEditingTaskId}
                    onSubmitEdit={handleTaskEdit}
                  />
                )}
              </div>
            </Panel>

            <Panel title="Корзина задач" subtitle="Удалённые задачи видны всем в разделе переменного состава." icon={<TrashIcon className="h-4 w-4" />} accent="#fb7185">
              <div className="grid gap-2 p-3">
                {data.deletedDailyTasks.length === 0 ? <Empty text="Корзина задач пуста." /> : data.deletedDailyTasks.map((task) => (
                  <article key={task.id} className="rounded-2xl p-3" style={rowCardStyle}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-(--text-primary)">{task.title}</p>
                        <p className="mt-1 text-xs text-(--text-muted)">{task.profile.name} - {task.taskDate}</p>
                        {task.description && <p className="mt-2 text-xs leading-5 text-(--text-secondary)">{task.description}</p>}
                      </div>
                      <span className="rounded-lg px-2 py-1 text-xs font-mono" style={mutedBadgeStyle}>{formatDateTime(task.deletedAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {tab === "leave" && (
          <section className="grid gap-4">
            <Panel title="Заявка в увольнение" subtitle="Дневной, суточный или отпуск с выбором периода." icon={<LeaveIcon className="h-4 w-4" />} accent="#fbbf24">
              <form onSubmit={handleLeave} className="space-y-3 p-4">
                <UserSelect users={data.variableUsers} isAdmin={isAdmin} currentProfileId={defaultProfileId} />
                <Field label="Тип увольнения">
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
                  <Field label="Время убытия"><input name="departureTime" type="time" className={inputClassName} style={inputStyle} /></Field>
                  <Field label="Время прибытия"><input name="arrivalTime" type="time" className={inputClassName} style={inputStyle} /></Field>
                </div>
                <Field label="Комментарий"><textarea name="comment" rows={4} placeholder="Причина, маршрут, дополнительные условия" className={inputClassName} style={inputStyle} /></Field>
                <button disabled={isPending} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={primaryButtonStyle}>Отправить заявку</button>
              </form>
            </Panel>

            <Panel title="Заявки" subtitle="30 дней, будущие и прошедшие увольнения с фильтрами по человеку и дате." icon={<ShieldIcon className="h-4 w-4" />} accent="#a78bfa">
              <div className="grid gap-3 p-3">
                <MonthNavigator month={data.selectedMonth} onChange={handleMonthChange} />
                <LeaveMonthCalendar days={monthDays} requestsByDay={leaveCalendarByDay} totalCount={leaveCalendarRows.length} todayDate={data.todayDate} />
                <SegmentedTabs
                  value={leaveTab}
                  items={[{ key: "thirty", label: "30 дней" }, { key: "future", label: "Будущие" }, { key: "past", label: "Прошедшие" }]}
                  onChange={(value) => setLeaveTab(value as LeaveTab)}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  {isAdmin && (
                    <Field label="Фильтр по человеку">
                      <Select
                        value={leavePersonFilter}
                        onChange={(event) => setLeavePersonFilter(event.currentTarget.value)}
                        options={[{ value: "all", label: "Все" }, ...data.variableUsers.map((user) => ({ value: String(user.id), label: user.name }))]}
                      />
                    </Field>
                  )}
                  <Field label="Фильтр по дате"><input type="date" value={leaveDateFilter} onChange={(event) => setLeaveDateFilter(event.currentTarget.value)} className={inputClassName} style={inputStyle} /></Field>
                </div>
                {leaveRows.length === 0 ? <Empty text="Заявок под выбранные фильтры нет." /> : leaveRows.map((request) => (
                  <article key={request.id} className="rounded-2xl p-3" style={rowCardStyle}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-(--text-primary)">{LEAVE_LABELS[request.leaveType]}</p>
                          <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={leaveBadgeStyle(request.status)}>{STATUS_LABELS[request.status]}</span>
                        </div>
                        <p className="mt-1 text-xs text-(--text-muted)">{request.profile.name} · {request.dateFrom} — {request.dateTo}</p>
                        <p className="mt-1 text-xs text-(--text-secondary)">Убытие: {request.departureTime || "—"} · Прибытие: {request.arrivalTime || "—"}</p>
                        {request.comment && <p className="mt-2 text-xs leading-5 text-(--text-secondary)">{request.comment}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {isAdmin && request.status === "pending" && (
                          <>
                            <button type="button" disabled={isPending} onClick={() => reviewLeave(request.id, "approved")} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={successButtonStyle}>Одобрить</button>
<button type="button" disabled={isPending} onClick={() => reviewLeave(request.id, "rejected")} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={dangerButtonStyle}>Отклонить</button>
                          </>
                        )}
                        {request.status === "approved" && (isAdmin || request.profileUserId === currentProfileId) && (
                          <button type="button" disabled={isPending} onClick={() => reviewLeave(request.id, "revoked")} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={warningButtonStyle}>Отозвать</button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {tab === "duty" && (
          <section className={isAdmin ? "grid gap-4" : "grid gap-4"}>
            {isAdmin && (
              <div className="grid gap-4">
                <Panel title="Назначить суточный наряд" subtitle="Период показывается с выбранного дня по следующий день; первый день — заступающий наряд." icon={<DutyIcon className="h-4 w-4" />} accent="#a78bfa">
                  <form onSubmit={handleDuty} className="space-y-3 p-4">
                    <Field label="Дата заступления"><input name="dutyDate" type="date" defaultValue={data.tomorrowDate} className={inputClassName} style={inputStyle} /></Field>
                    {DUTY_SLOTS.map((slot) => (
                      <Field key={slot.key} label={slot.label}><UserOptionSelect name={slot.key} users={data.variableUsers} /></Field>
                    ))}
                    <button disabled={isPending} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={primaryButtonStyle}>Сохранить наряд</button>
                  </form>
                </Panel>

                <Panel title="Рабочая группа" subtitle="Дневное РГ, Ночное РГ и Информационное РГ назначаются диапазоном дат." icon={<ShieldIcon className="h-4 w-4" />} accent="#38bdf8">
                  <form onSubmit={handleWorkGroupDuty} className="space-y-3 p-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="С какого числа"><input name="dateFrom" type="date" defaultValue={data.todayDate} className={inputClassName} style={inputStyle} /></Field>
                      <Field label="По какое число"><input name="dateTo" type="date" defaultValue={addDateDays(data.todayDate, 30)} className={inputClassName} style={inputStyle} /></Field>
                    </div>
                    {WORK_GROUP_SLOTS.map((slot) => (
                      <Field key={slot.key} label={slot.label}><UserOptionSelect name={slot.key} users={data.variableUsers} /></Field>
                    ))}
                    <button disabled={isPending} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={primaryButtonStyle}>Сохранить РГ</button>
                  </form>
                </Panel>
              </div>
            )}

            <Panel title="Расписание нарядов" subtitle="Планируемые периоды, прошедшие наряды и отдельная подвкладка рабочей группы." icon={<CalendarIcon className="h-4 w-4" />} accent="#34d399">
              <div className="grid gap-3 p-3">
                <MonthNavigator month={data.selectedMonth} onChange={handleMonthChange} />
                <DutyMonthCalendar days={monthDays} entriesByDay={dutyCalendarByDay} totalCount={dutyCalendarRows.length} todayDate={data.todayDate} />
                <SegmentedTabs value={dutyTab} items={[{ key: "planned", label: "Планируемые" }, { key: "past", label: "Прошедшие" }]} onChange={(value) => setDutyTab(value as DutyTab)} />
                {dutyTab === "planned" && <SegmentedTabs value={dutyPeriod} items={[{ key: "week", label: "Неделя" }, { key: "month", label: "Месяц" }, { key: "nextMonth", label: "След. месяц" }, { key: "year", label: "Год" }]} onChange={(value) => setDutyPeriod(value as DutyPeriod)} />}
                <DutyGroups groups={groupedDuty} slots={DUTY_SLOTS} todayDate={data.todayDate} emptyText="Нарядов за выбранный период нет." />
                <div className="rounded-2xl p-3" style={subPanelStyle}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div><p className="text-sm font-semibold text-(--text-primary)">Рабочая группа</p><p className="mt-1 text-xs text-(--text-muted)">Дневное, ночное и информационное РГ.</p></div>
                    <span className="rounded-lg px-2 py-1 text-xs font-mono" style={mutedBadgeStyle}>{groupedWorkDuty.length}</span>
                  </div>
                  <DutyGroups groups={groupedWorkDuty} slots={WORK_GROUP_SLOTS} todayDate={data.todayDate} emptyText="Назначений рабочей группы нет." />
                </div>
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
  return <Field label="Военнослужащий"><UserOptionSelect name="profileUserId" users={users} defaultValue={currentProfileId} /></Field>;
}

function UserOptionSelect({ name, users, defaultValue }: { name: string; users: VariableSectionData["variableUsers"]; defaultValue?: number }) {
  return (
    <Select
      name={name}
      required
      defaultValue={defaultValue ? String(defaultValue) : ""}
      options={[{ value: "", label: "Выберите человека", disabled: true }, ...users.map((user) => ({ value: String(user.id), label: user.name }))]}
    />
  );
}

function Select({ options, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string; disabled?: boolean }> }) {
  return (
    <div className="relative">
      <select {...props} className={`${inputClassName} pr-10 ${props.className ?? ""}`} style={{ ...selectStyle, ...props.style }}>
        {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-muted)" />
    </div>
  );
}

function SegmentedTabs({ value, items, onChange }: { value: string; items: Array<{ key: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl p-1" style={filterStyle}>
      {items.map((item) => (
        <button key={item.key} type="button" onClick={() => onChange(item.key)} className="cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors" style={value === item.key ? activeCountStyle : mutedButtonStyle}>
          {item.label}
        </button>
      ))}
    </div>
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
  isAdmin,
  currentProfileId,
  todayDate,
  editingTaskId,
  onToggle,
  onDelete,
  onEdit,
  onSubmitEdit,
}: {
  title: string;
  subtitle: string;
  accent: string;
  tasks: VariableSectionData["dailyTasks"];
  emptyText: string;
  isPending: boolean;
  isAdmin: boolean;
  currentProfileId: number | null;
  todayDate: string;
  editingTaskId: number | null;
  onToggle: (id: number, status: "todo" | "done") => void;
  onDelete: (id: number) => void;
  onEdit: (id: number | null) => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>, id: number) => void;
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
          <TaskRow
            key={task.id}
            task={task}
            isPending={isPending}
            canEdit={task.taskDate >= todayDate && (isAdmin || task.profileUserId === currentProfileId)}
            isEditing={editingTaskId === task.id}
            onToggle={onToggle}
            onDelete={onDelete}
            onEdit={onEdit}
            onSubmitEdit={onSubmitEdit}
          />
        ))}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  isPending,
  canEdit,
  isEditing,
  onToggle,
  onDelete,
  onEdit,
  onSubmitEdit,
}: {
  task: VariableSectionData["dailyTasks"][number];
  isPending: boolean;
  canEdit: boolean;
  isEditing: boolean;
  onToggle: (id: number, status: "todo" | "done") => void;
  onDelete: (id: number) => void;
  onEdit: (id: number | null) => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>, id: number) => void;
}) {
  if (isEditing) {
    return (
      <article className="rounded-2xl p-3 transition-colors hover:bg-white/[0.025]" style={rowCardStyle}>
        <form onSubmit={(event) => onSubmitEdit(event, task.id)} className="space-y-2">
          <Field label="Задача"><input name="title" required maxLength={200} defaultValue={task.title} className={inputClassName} style={inputStyle} /></Field>
          <Field label="Комментарий"><textarea name="description" rows={3} defaultValue={task.description ?? ""} className={inputClassName} style={inputStyle} /></Field>
          <div className="flex gap-2">
            <button disabled={isPending} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-wait disabled:opacity-60" style={successButtonStyle}>Сохранить</button>
            <button type="button" onClick={() => onEdit(null)} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold" style={mutedButtonStyle}>Отмена</button>
          </div>
        </form>
      </article>
    );
  }

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
          {!canEdit && <p className="mt-2 text-[11px] text-(--text-muted)">Прошедший день заблокирован для изменений.</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-lg px-2 py-1 text-xs font-mono" style={task.status === "done" ? successBadgeStyle : mutedBadgeStyle}>{task.status === "done" ? "готово" : "план"}</span>
          <button type="button" disabled={isPending || !canEdit} onClick={() => onToggle(task.id, task.status === "done" ? "todo" : "done")} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50" style={task.status === "done" ? mutedButtonStyle : successButtonStyle}>
            {task.status === "done" ? "Вернуть" : "Готово"}
          </button>
          {canEdit && <button type="button" disabled={isPending} onClick={() => onEdit(task.id)} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={primaryButtonStyle}>Изменить</button>}
          {canEdit && <button type="button" disabled={isPending} onClick={() => onDelete(task.id)} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60" style={dangerButtonStyle}>В корзину</button>}
        </div>
      </div>
    </article>
  );
}

function MonthNavigator({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl p-2" style={calendarToolbarStyle}>
      <button type="button" onClick={() => onChange(prev)} className="cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" style={mutedButtonStyle}>Пред. месяц</button>
      <div className="flex min-w-0 items-center gap-2 rounded-xl px-3 py-1.5" style={monthTitleStyle}>
        <CalendarIcon className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm font-semibold capitalize text-(--text-primary)">{formatMonthLabel(month)}</span>
      </div>
      <button type="button" onClick={() => onChange(next)} className="cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" style={mutedButtonStyle}>След. месяц</button>
    </div>
  );
}

const LeaveMonthCalendar = memo(function LeaveMonthCalendar({ days, requestsByDay, totalCount, todayDate }: { days: string[]; requestsByDay: LeaveCalendarByDay; totalCount: number; todayDate: string }) {
  return (
    <CalendarFrame title="Календарь увольнений" subtitle="Все увольнения, весь срок, можно листать и не надо скроллить." totalCount={totalCount} tone="#fbbf24">
      <MonthGrid days={days} todayDate={todayDate} renderDay={(day) => <LeaveDayEvents rows={requestsByDay.get(day) ?? []} day={day} />} />
    </CalendarFrame>
  );
});

const DutyMonthCalendar = memo(function DutyMonthCalendar({ days, entriesByDay, totalCount, todayDate }: { days: string[]; entriesByDay: DutyCalendarByDay; totalCount: number; todayDate: string }) {
  return (
    <CalendarFrame title="Календарь нарядов" subtitle="Суточные наряды и РГ разведены по цвету и отдельным блокам внутри дня." totalCount={totalCount} tone="#34d399">
      <MonthGrid days={days} todayDate={todayDate} renderDay={(day) => <DutyDayEvents rows={entriesByDay.get(day) ?? []} day={day} />} />
    </CalendarFrame>
  );
});

function CalendarFrame({ title, subtitle, totalCount, tone, children }: { title: string; subtitle: string; totalCount: number; tone: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl" style={calendarFrameStyle}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5" style={{ borderBottom: "1px solid var(--glass-border)", background: `linear-gradient(90deg, ${tone}14, transparent 70%)` }}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-(--text-primary)">{title}</p>
          <p className="mt-0.5 text-xs text-(--text-muted)">{subtitle}</p>
        </div>
        <span className="rounded-lg px-2 py-1 text-xs font-mono" style={{ ...mutedBadgeStyle, color: tone, borderColor: `${tone}55` }}>{totalCount}</span>
      </div>
      {children}
    </section>
  );
}

const MonthGrid = memo(function MonthGrid({ days, todayDate, renderDay }: { days: string[]; todayDate: string; renderDay: (day: string) => ReactNode }) {
  const activeMonth = days[10]?.slice(0, 7) ?? todayDate.slice(0, 7);
  return (
    <div className="overflow-x-auto p-2.5 [scrollbar-width:thin]" style={calendarScrollerStyle}>
      <div className="grid min-w-[1180px] grid-cols-7 gap-2 xl:min-w-0">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
          <div key={day} className="sticky top-0 z-10 rounded-lg px-2 py-2 text-center text-xs font-semibold backdrop-blur-sm" style={calendarWeekdayStyle}>{day}</div>
        ))}
        {days.map((day) => {
          const inMonth = day.slice(0, 7) === activeMonth;
          return (
            <div key={day} className="min-h-44 rounded-xl p-2.5 transition-colors duration-200" style={day === todayDate ? calendarTodayStyle : inMonth ? calendarDayStyle : calendarMutedDayStyle}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold" style={{ color: inMonth ? "var(--text-primary)" : "var(--text-muted)" }}>{Number(day.slice(8, 10))}</span>
                {day === todayDate && <span className="rounded-md px-1.5 py-0.5 text-[10px]" style={infoPillStyle}>Сегодня</span>}
              </div>
              <div className="grid min-w-0 gap-1.5">{renderDay(day)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

function LeaveDayEvents({ rows, day }: { rows: VariableSectionData["leaveRequests"]; day: string }) {
  if (rows.length === 0) return <p className="rounded-lg px-2 py-1.5 text-[11px] text-(--text-muted)" style={calendarEmptyDayStyle}>Нет увольнений</p>;
  const visible = rows.slice(0, 3);
  return (
    <>
      {visible.map((request) => (
        <div key={`${request.id}-${day}`} className="min-w-0 rounded-lg p-2.5" style={{ ...calendarItemStyle, borderLeft: `3px solid ${leaveTone(request.status)}` }}>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <PersonNameDisclosure name={request.profile.name} compact />
            <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px]" style={leaveBadgeStyle(request.status)}>{STATUS_LABELS[request.status]}</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-(--text-secondary)" style={wrapTextStyle}>{LEAVE_LABELS[request.leaveType]}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-(--text-muted)" style={wrapTextStyle}>{request.departureTime || "-"} / {request.arrivalTime || "-"}</p>
          {request.comment && <p className="mt-1 max-h-10 overflow-hidden text-[11px] leading-4 text-(--text-secondary)" style={wrapTextStyle}>{request.comment}</p>}
        </div>
      ))}
      {rows.length > visible.length && <MoreEventsBadge count={rows.length - visible.length} />}
    </>
  );
}

function DutyDayEvents({ rows, day }: { rows: DutyAssignments; day: string }) {
  if (rows.length === 0) return <p className="rounded-lg px-2 py-1.5 text-[11px] text-(--text-muted)" style={calendarEmptyDayStyle}>Нет нарядов</p>;
  const dailyRows = rows.filter((entry) => DUTY_SLOTS.some((slot) => slot.key === entry.slot));
  const workGroupRows = rows.filter((entry) => WORK_GROUP_SLOTS.some((slot) => slot.key === entry.slot));
  return (
    <>
      <DutyDaySection label="Суточный" rows={dailyRows} slots={DUTY_SLOTS} day={day} tone="daily" />
      <DutyDaySection label="РГ" rows={workGroupRows} slots={WORK_GROUP_SLOTS} day={day} tone="workGroup" />
    </>
  );
}

function DutyDaySection({ label, rows, slots, day, tone }: { label: string; rows: DutyAssignments; slots: Array<{ key: VariableDutySlot; label: string; short: string }>; day: string; tone: "daily" | "workGroup" }) {
  if (rows.length === 0) return null;
  const visible = rows.slice(0, 3);
  const isWorkGroup = tone === "workGroup";
  return (
    <div className="grid min-w-0 gap-1.5 rounded-xl p-1.5" style={isWorkGroup ? workGroupSectionStyle : dailySectionStyle}>
      <div className="flex min-w-0 items-center justify-between gap-2 px-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={isWorkGroup ? workGroupLabelStyle : dailyLabelStyle}>{label}</span>
        <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-mono" style={isWorkGroup ? workGroupBadgeStyle : successBadgeStyle}>{rows.length}</span>
      </div>
      {visible.map((entry) => {
        const slot = slots.find((item) => item.key === entry.slot);
        return <DutyCalendarCard key={`${entry.id}-${day}`} entry={entry} slot={slot} isWorkGroup={isWorkGroup} />;
      })}
      {rows.length > visible.length && <MoreEventsBadge count={rows.length - visible.length} />}
    </div>
  );
}

function DutyCalendarCard({ entry, slot, isWorkGroup }: { entry: DutyAssignments[number]; slot?: { label: string; short: string }; isWorkGroup: boolean }) {
  return (
    <div className="min-w-0 rounded-lg p-2.5" style={isWorkGroup ? workGroupCalendarItemStyle : dailyCalendarItemStyle}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <PersonNameDisclosure name={entry.user.name} compact />
        <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-mono" style={isWorkGroup ? workGroupBadgeStyle : mutedBadgeStyle}>{slot?.short ?? entry.slot}</span>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-(--text-secondary)" style={wrapTextStyle}>{slot?.label ?? entry.slot}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-(--text-muted)" style={wrapTextStyle}>{entry.dateFrom} - {entry.dateTo}</p>
    </div>
  );
}

function MoreEventsBadge({ count }: { count: number }) {
  return <span className="rounded-lg px-2 py-1 text-[10px] font-semibold" style={calendarMoreStyle}>+{count} ещё</span>;
}

function PersonNameDisclosure({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <details className="min-w-0 flex-1">
      <summary
        className={`cursor-pointer list-none font-semibold text-(--text-primary) transition-colors hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${compact ? "text-[11px] leading-4" : "text-sm leading-5"}`}
        style={personSummaryStyle}
        title={`${name} — нажмите, чтобы раскрыть полностью`}
      >
        {name}
      </summary>
      <div className="mt-1 rounded-lg px-2 py-1.5 text-xs leading-4 text-(--text-secondary)" style={personDetailsStyle}>
        {name}
      </div>
    </details>
  );
}

function DutyGroups({ groups, slots, todayDate, emptyText }: { groups: Array<[string, DutyAssignments]>; slots: Array<{ key: VariableDutySlot; label: string; short: string }>; todayDate: string; emptyText: string }) {
  return (
    <div className="grid gap-2">
      {groups.length === 0 ? <Empty text={emptyText} /> : groups.map(([date, entries]) => <DutyGroup key={`${date}-${slots[0]?.key}`} date={date} entries={entries} slots={slots} todayDate={todayDate} />)}
    </div>
  );
}

function DutyGroup({ date, entries, slots, todayDate }: { date: string; entries: DutyAssignments; slots: Array<{ key: VariableDutySlot; label: string; short: string }>; todayDate: string }) {
  const first = entries[0];
  const isStarting = first?.dateFrom === todayDate;
  return (
    <article className="rounded-2xl p-3" style={rowCardStyle}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-(--text-primary)">с {first?.dateFrom ?? date} по {first?.dateTo ?? date}</p>
          <p className="mt-1 text-xs text-(--text-muted)">{isStarting ? "Заступающий наряд" : "Период наряда"}</p>
        </div>
        <span className="rounded-lg px-2 py-1 text-xs font-mono" style={entries.length === slots.length ? successBadgeStyle : mutedBadgeStyle}>{entries.length}/{slots.length}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {slots.map((slot) => {
          const entry = entries.find((item) => item.slot === slot.key);
          return (
            <div key={slot.key} className="rounded-xl px-3 py-2" style={dutySlotStyle}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-(--text-muted)">{slot.label}</p>
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono" style={mutedBadgeStyle}>{slot.short}</span>
              </div>
              {entry ? <PersonNameDisclosure name={entry.user.name} /> : <p className="text-sm font-semibold text-(--text-primary)">Не назначен</p>}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function groupDutyByDate(rows: DutyAssignments): Array<[string, DutyAssignments]> {
  const byDate = new Map<string, DutyAssignments>();
  for (const entry of rows) {
    const bucket = byDate.get(entry.dateFrom) ?? [];
    bucket.push(entry);
    byDate.set(entry.dateFrom, bucket);
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function sortDuty(a: DutyAssignments[number], b: DutyAssignments[number]): number {
  return a.dateFrom.localeCompare(b.dateFrom) || a.slot.localeCompare(b.slot);
}

type LeaveCalendarByDay = Map<string, VariableSectionData["leaveRequests"]>;
type DutyCalendarByDay = Map<string, DutyAssignments>;

function buildLeaveCalendarByDay(days: string[], rows: VariableSectionData["leaveRequests"]): LeaveCalendarByDay {
  const byDay: LeaveCalendarByDay = new Map(days.map((day) => [day, []]));
  for (const row of rows) {
    for (const day of days) {
      if (row.dateFrom <= day && row.dateTo >= day) byDay.get(day)?.push(row);
    }
  }
  return byDay;
}

function buildDutyCalendarByDay(days: string[], rows: DutyAssignments): DutyCalendarByDay {
  const byDay: DutyCalendarByDay = new Map(days.map((day) => [day, []]));
  for (const row of rows) {
    for (const day of days) {
      if (row.dateFrom <= day && row.dateTo >= day) byDay.get(day)?.push(row);
    }
  }
  return byDay;
}

function leaveTone(status: VariableLeaveStatus): string {
  if (status === "approved") return "#34d399";
  if (status === "rejected") return "#f87171";
  if (status === "revoked") return "#94a3b8";
  return "#fbbf24";
}

function getDutyPeriodRange(period: DutyPeriod, todayDate: string): [string, string] {
  if (period === "week") return [todayDate, addDateDays(todayDate, 6)];
  if (period === "year") return [todayDate, addDateDays(todayDate, 365)];
  const today = parseDateKey(todayDate);
  if (period === "nextMonth") {
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    return [toDateKey(start), toDateKey(end)];
  }
  return [todayDate, toDateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0))];
}

function getMonthRange(month: string): [string, string] {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 0);
  return [toDateKey(start), toDateKey(end)];
}

function getMonthCalendarDays(month: string): string[] {
  const [start, end] = getMonthRange(month);
  const first = parseDateKey(start);
  const last = parseDateKey(end);
  const gridStart = new Date(first);
  const mondayOffset = (gridStart.getDay() + 6) % 7;
  gridStart.setDate(gridStart.getDate() - mondayOffset);
  const gridEnd = new Date(last);
  const sundayOffset = (7 - ((gridEnd.getDay() + 6) % 7) - 1) % 7;
  gridEnd.setDate(gridEnd.getDate() + sundayOffset);
  const days: string[] = [];
  for (const day = new Date(gridStart); day <= gridEnd; day.setDate(day.getDate() + 1)) {
    days.push(toDateKey(day));
  }
  return days;
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  return parseDateKey(`${month}-01`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function addDateDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function leaveBadgeStyle(status: VariableLeaveStatus): CSSProperties {
  if (status === "approved") return successBadgeStyle;
  if (status === "rejected") return dangerBadgeStyle;
  if (status === "revoked") return mutedBadgeStyle;
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

function TrashIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5.5h14" /><path d="M8 5.5V3.5h4v2" /><path d="M6 8v8" /><path d="M10 8v8" /><path d="M14 8v8" /><path d="M5 5.5 6 17h8l1-11.5" /></svg>;
}

function ChevronDownIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5.5 7.5 4.5 5 4.5-5" /></svg>;
}

const inputClassName = "w-full rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 [color-scheme:dark]";

const pageShellStyle: CSSProperties = { scrollBehavior: "auto" };
const heroStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(2,6,23,0.58))",
  border: "1px solid var(--glass-border)",
  boxShadow: "0 14px 34px rgba(2,6,23,0.24)",
};
const panelStyle: CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", boxShadow: "0 12px 30px rgba(2,6,23,0.18)", contentVisibility: "auto", containIntrinsicSize: "520px" };
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
const warningButtonStyle: CSSProperties = { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)", color: "#fbbf24" };
const tabCardStyle: CSSProperties = { background: "rgba(15,23,42,0.58)", border: "1px solid var(--glass-border)", boxShadow: "0 10px 24px rgba(2,6,23,0.16)" };
const activeTabCardStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(56,189,248,0.09))", border: "1px solid rgba(52,211,153,0.38)", boxShadow: "0 12px 30px rgba(34,197,94,0.10)" };
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
const calendarToolbarStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(15,23,42,0.78), rgba(2,6,23,0.44))", border: "1px solid var(--glass-border)" };
const monthTitleStyle: CSSProperties = { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(52,211,153,0.30)", color: "#34d399" };
const calendarFrameStyle: CSSProperties = { background: "rgba(2,6,23,0.34)", border: "1px solid var(--glass-border)", contentVisibility: "auto", containIntrinsicSize: "860px" };
const calendarScrollerStyle: CSSProperties = { overscrollBehaviorX: "contain" };
const calendarWeekdayStyle: CSSProperties = { background: "rgba(15,23,42,0.86)", border: "1px solid rgba(148,163,184,0.14)", color: "#94a3b8" };
const calendarDayStyle: CSSProperties = { background: "rgba(15,23,42,0.44)", border: "1px solid rgba(148,163,184,0.16)", contain: "layout paint" };
const calendarMutedDayStyle: CSSProperties = { background: "rgba(15,23,42,0.20)", border: "1px solid rgba(148,163,184,0.10)", opacity: 0.74, contain: "layout paint" };
const calendarTodayStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(34,197,94,0.08))", border: "1px solid rgba(56,189,248,0.40)", contain: "layout paint" };
const calendarItemStyle: CSSProperties = { background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" };
const calendarEmptyDayStyle: CSSProperties = { background: "rgba(148,163,184,0.055)", border: "1px dashed rgba(148,163,184,0.14)" };
const calendarMoreStyle: CSSProperties = { background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.22)", color: "#38bdf8" };
const dailySectionStyle: CSSProperties = { background: "rgba(34,197,94,0.045)", border: "1px solid rgba(52,211,153,0.14)" };
const workGroupSectionStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(124,58,237,0.13), rgba(56,189,248,0.055))", border: "1px solid rgba(167,139,250,0.30)" };
const dailyCalendarItemStyle: CSSProperties = { ...calendarItemStyle, borderLeft: "3px solid #34d399" };
const workGroupCalendarItemStyle: CSSProperties = { background: "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(56,189,248,0.08))", border: "1px solid rgba(167,139,250,0.28)", borderLeft: "3px solid #a78bfa", boxShadow: "inset 0 0 0 1px rgba(167,139,250,0.06)" };
const dailyLabelStyle: CSSProperties = { color: "#34d399" };
const workGroupLabelStyle: CSSProperties = { color: "#c4b5fd" };
const workGroupBadgeStyle: CSSProperties = { background: "rgba(124,58,237,0.18)", border: "1px solid rgba(167,139,250,0.34)", color: "#c4b5fd" };
const wrapTextStyle: CSSProperties = { overflowWrap: "anywhere", wordBreak: "break-word" };
const personSummaryStyle: CSSProperties = { ...wrapTextStyle, outlineOffset: "3px" };
const personDetailsStyle: CSSProperties = { ...wrapTextStyle, background: "rgba(15,23,42,0.72)", border: "1px solid rgba(148,163,184,0.18)" };
const errorBannerStyle: CSSProperties = { background: "rgba(239,68,68,0.11)", border: "1px solid rgba(239,68,68,0.28)", color: "#fca5a5" };
