"use client";

import { useCallback, useMemo, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { VariableSectionData } from "@/entities/variable/variableRepository";
import type { VariableDutySlot, VariableLeaveStatus, VariableLeaveType } from "@/shared/db/schema";

const DUTY_SLOTS: Array<{ key: VariableDutySlot; label: string }> = [
  { key: "day_orderly_1", label: "Дневальный 1" },
  { key: "day_orderly_2", label: "Дневальный 2" },
  { key: "duty_officer", label: "Дежурный" },
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

export function VariablePageClient({ data, isAdmin, currentProfileId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("tasks");
  const [isPending, startTransition] = useTransition();
  const defaultProfileId = currentProfileId ?? data.variableUsers[0]?.id ?? 0;

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  const postJson = useCallback(async (url: string, method: string, payload: unknown) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
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
    void postJson(`/api/variable/leave-requests/${id}`, "PATCH", { status });
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

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4" style={{ opacity: isPending ? 0.75 : 1 }}>
      <section className="rounded-2xl p-3 flex flex-wrap items-center gap-2" style={panelStyle}>
        {(["tasks", "leave", "duty"] as Tab[]).map((key) => (
          <button key={key} type="button" onClick={() => setTab(key)} className="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold transition-colors" style={tab === key ? activeTabStyle : mutedButtonStyle}>
            {key === "tasks" ? "Задачи" : key === "leave" ? "Увал" : "Наряды"}
          </button>
        ))}
        <form onSubmit={handleDateFilter} className="ml-auto flex items-center gap-2">
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>Показать с</label>
          <input name="date" type="date" defaultValue={data.selectedDate} className="rounded-xl px-3 py-2 text-sm" style={inputStyle} />
          <button className="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold" style={mutedButtonStyle}>Обновить</button>
        </form>
      </section>

      {tab === "tasks" && (
        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Задача на следующий день" subtitle="По умолчанию ставится на завтра; дату можно изменить.">
            <form onSubmit={handleDailyTask} className="space-y-3 p-4">
              <UserSelect users={data.variableUsers} isAdmin={isAdmin} currentProfileId={defaultProfileId} />
              <input name="taskDate" type="date" defaultValue={data.tomorrowDate} className="w-full rounded-xl px-3 py-2 text-sm" style={inputStyle} />
              <input name="title" required maxLength={200} placeholder="Что нужно сделать" className="w-full rounded-xl px-3 py-2 text-sm" style={inputStyle} />
              <textarea name="description" rows={4} placeholder="Комментарий" className="w-full rounded-xl px-3 py-2 text-sm" style={inputStyle} />
              <button className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold" style={primaryButtonStyle}>Добавить</button>
            </form>
          </Panel>
          <Panel title="Задачи по датам" subtitle="История и завтрашние задачи переменного состава.">
            <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
              {data.dailyTasks.length === 0 ? <Empty text="Задач за выбранный период нет." /> : data.dailyTasks.map((task) => (
                <article key={task.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{task.title}</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{task.taskDate} · {task.profile.name}</p>
                      {task.description && <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>{task.description}</p>}
                    </div>
                    <span className="rounded-lg px-2 py-1 text-xs font-mono" style={task.status === "done" ? successBadgeStyle : mutedBadgeStyle}>{task.status === "done" ? "готово" : "план"}</span>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </section>
      )}

      {tab === "leave" && (
        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Заявка в увал" subtitle="Дневной, суточный или отпуск отправляются на рассмотрение.">
            <form onSubmit={handleLeave} className="space-y-3 p-4">
              <UserSelect users={data.variableUsers} isAdmin={isAdmin} currentProfileId={defaultProfileId} />
              <select name="leaveType" defaultValue="day" className="w-full rounded-xl px-3 py-2 text-sm" style={inputStyle}>
                {Object.entries(LEAVE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="dateFrom" type="date" defaultValue={data.tomorrowDate} className="rounded-xl px-3 py-2 text-sm" style={inputStyle} />
                <input name="dateTo" type="date" defaultValue={data.tomorrowDate} className="rounded-xl px-3 py-2 text-sm" style={inputStyle} />
              </div>
              <textarea name="comment" rows={4} placeholder="Причина / комментарий" className="w-full rounded-xl px-3 py-2 text-sm" style={inputStyle} />
              <button className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold" style={primaryButtonStyle}>Отправить заявку</button>
            </form>
          </Panel>
          <Panel title="Заявки" subtitle="Админ подтверждает или отклоняет, переменный состав видит свои статусы.">
            <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
              {data.leaveRequests.length === 0 ? <Empty text="Заявок за выбранный период нет." /> : data.leaveRequests.map((request) => (
                <article key={request.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{LEAVE_LABELS[request.leaveType]} · {request.profile.name}</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{request.dateFrom} — {request.dateTo}</p>
                      {request.comment && <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>{request.comment}</p>}
                    </div>
                    <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={leaveBadgeStyle(request.status)}>{STATUS_LABELS[request.status]}</span>
                  </div>
                  {isAdmin && request.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => reviewLeave(request.id, "approved")} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold" style={successButtonStyle}>Одобрить</button>
                      <button type="button" onClick={() => reviewLeave(request.id, "rejected")} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold" style={dangerButtonStyle}>Отклонить</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </Panel>
        </section>
      )}

      {tab === "duty" && (
        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          {isAdmin && (
            <Panel title="Назначить наряд" subtitle="На дату нужно выбрать двух дневальных и одного дежурного.">
              <form onSubmit={handleDuty} className="space-y-3 p-4">
                <input name="dutyDate" type="date" defaultValue={data.tomorrowDate} className="w-full rounded-xl px-3 py-2 text-sm" style={inputStyle} />
                {DUTY_SLOTS.map((slot) => (
                  <label key={slot.key} className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    {slot.label}
                    <select name={slot.key} required defaultValue="" className="mt-1 w-full rounded-xl px-3 py-2 text-sm" style={inputStyle}>
                      <option value="" disabled>Выберите человека</option>
                      {data.variableUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                  </label>
                ))}
                <button className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold" style={primaryButtonStyle}>Сохранить наряд</button>
              </form>
            </Panel>
          )}
          <Panel title="Расписание нарядов" subtitle="2 дневальных и 1 дежурный на каждые сутки.">
            <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
              {groupedDuty.length === 0 ? <Empty text="Нарядов за выбранный период нет." /> : groupedDuty.map(([date, entries]) => (
                <article key={date} className="px-4 py-3">
                  <p className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{date}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {DUTY_SLOTS.map((slot) => {
                      const entry = entries.find((item) => item.slot === slot.key);
                      return <div key={slot.key} className="rounded-xl px-3 py-2" style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{slot.label}</p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{entry?.user.name ?? "Не назначен"}</p>
                      </div>;
                    })}
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </section>
      )}
    </main>
  );
}

function UserSelect({ users, isAdmin, currentProfileId }: { users: VariableSectionData["variableUsers"]; isAdmin: boolean; currentProfileId: number }) {
  if (!isAdmin) return <input type="hidden" name="profileUserId" value={currentProfileId} />;
  return (
    <select name="profileUserId" defaultValue={currentProfileId} className="w-full rounded-xl px-3 py-2 text-sm" style={inputStyle}>
      {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
    </select>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-2xl" style={panelStyle}>
    <div className="border-b px-4 py-3" style={{ borderColor: "var(--glass-border)" }}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
    </div>
    {children}
  </section>;
}

function Empty({ text }: { text: string }) {
  return <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>{text}</div>;
}

function leaveBadgeStyle(status: VariableLeaveStatus): CSSProperties {
  if (status === "approved") return successBadgeStyle;
  if (status === "rejected") return dangerBadgeStyle;
  return { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)", color: "#fbbf24" };
}

const panelStyle: CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" };
const inputStyle: CSSProperties = { background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" };
const primaryButtonStyle: CSSProperties = { background: "var(--accent-glow)", border: "1px solid rgba(139,92,246,0.3)", color: "var(--accent-400)" };
const mutedButtonStyle: CSSProperties = { background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" };
const activeTabStyle: CSSProperties = { background: "var(--accent-glow)", border: "1px solid rgba(139,92,246,0.3)", color: "var(--accent-400)" };
const mutedBadgeStyle: CSSProperties = { background: "rgba(148,163,184,0.12)", border: "1px solid rgba(148,163,184,0.25)", color: "#94a3b8" };
const successBadgeStyle: CSSProperties = { background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.28)", color: "#34d399" };
const dangerBadgeStyle: CSSProperties = { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", color: "#f87171" };
const successButtonStyle: CSSProperties = { background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.28)", color: "#34d399" };
const dangerButtonStyle: CSSProperties = { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", color: "#f87171" };
