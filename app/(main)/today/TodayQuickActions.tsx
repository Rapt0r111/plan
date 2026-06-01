"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MyDayAttentionItem, MyDayActionStatus } from "@/shared/lib/my-day";

const BOARD_STATUSES: Array<{ value: MyDayActionStatus; label: string }> = [
  { value: "todo", label: "К работе" },
  { value: "in_progress", label: "В работе" },
  { value: "blocked", label: "Блок" },
  { value: "done", label: "Готово" },
];

const OPERATIVE_STATUSES: Array<{ value: MyDayActionStatus; label: string }> = [
  { value: "todo", label: "К работе" },
  { value: "in_progress", label: "В работе" },
  { value: "done", label: "Готово" },
];

export function TodayQuickActions({ item, todayKey }: { item: MyDayAttentionItem; todayKey: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPatchTask = item.source === "board" || item.source === "operative";
  const statusOptions = item.source === "board" ? BOARD_STATUSES : item.source === "operative" ? OPERATIVE_STATUSES : [];

  async function run(label: string, action: () => Promise<void>) {
    setPending(label);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }

  async function patchStatus(status: MyDayActionStatus) {
    if (status === item.status) return;
    if (item.source === "board") {
      const body: Record<string, unknown> = { status };
      if (status === "blocked") {
        const reason = window.prompt("Причина блокировки", item.blockedReason ?? "Ожидает другого участника");
        if (!reason) return;
        body.blockedReason = reason;
      }
      await patchJson(`/api/tasks/${item.id}`, body);
      return;
    }
    if (item.source === "operative") {
      await patchJson(`/api/operative-tasks/${item.id}`, { status });
    }
  }

  async function complete() {
    if (item.source === "personal_plan") {
      await patchJson(`/api/personal-plan/${item.id}/completion`, {
        completed: true,
        date: item.dueDate?.slice(0, 10) ?? todayKey,
      });
      return;
    }
    await patchStatus("done");
  }

  async function changeDueDate() {
    if (!canPatchTask) return;
    const date = window.prompt("Новый срок в формате YYYY-MM-DD", item.dueDate?.slice(0, 10) ?? todayKey);
    if (!date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Укажите дату в формате YYYY-MM-DD");
    }
    await setDueDate(date);
  }

  async function postponeToTomorrow() {
    if (!canPatchTask) return;
    await setDueDate(addDays(todayKey, 1));
  }

  async function setDueDate(date: string) {
    const dueDate = `${date}T18:00:00.000Z`;
    const url = item.source === "board" ? `/api/tasks/${item.id}` : `/api/operative-tasks/${item.id}`;
    await patchJson(url, { dueDate });
  }

  async function addComment() {
    if (!canPatchTask) return;
    const body = window.prompt("Комментарий к задаче");
    if (!body?.trim()) return;
    const url = item.source === "board" ? `/api/tasks/${item.id}/comments` : `/api/operative-tasks/${item.id}/comments`;
    await postJson(url, { body: body.trim() });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]" onClick={(event) => event.stopPropagation()}>
      <a
        href={item.href}
        className="rounded-lg px-2.5 py-1 font-semibold transition-colors hover:bg-[var(--glass-02)]"
        style={{ border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
      >
        Открыть
      </a>
      <button
        type="button"
        disabled={!!pending}
        onClick={() => run("complete", complete)}
        className="rounded-lg px-2.5 py-1 font-semibold transition-colors disabled:opacity-50"
        style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.28)", color: "#4ade80" }}
      >
        {pending === "complete" ? "..." : "Завершить"}
      </button>
      {canPatchTask && (
        <>
          <button
            type="button"
            disabled={!!pending}
            onClick={() => run("due", changeDueDate)}
            className="rounded-lg px-2.5 py-1 font-semibold transition-colors disabled:opacity-50"
            style={{ border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
          >
            Срок
          </button>
          <button
            type="button"
            disabled={!!pending}
            onClick={() => run("tomorrow", postponeToTomorrow)}
            className="rounded-lg px-2.5 py-1 font-semibold transition-colors disabled:opacity-50"
            style={{ border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
          >
            На завтра
          </button>
          <button
            type="button"
            disabled={!!pending}
            onClick={() => run("comment", addComment)}
            className="rounded-lg px-2.5 py-1 font-semibold transition-colors disabled:opacity-50"
            style={{ border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
          >
            Комментарий
          </button>
          <label className="sr-only" htmlFor={`today-status-${item.source}-${item.id}`}>Изменить статус</label>
          <select
            id={`today-status-${item.source}-${item.id}`}
            value={item.status}
            disabled={!!pending}
            onChange={(event) => run("status", () => patchStatus(event.target.value as MyDayActionStatus))}
            className="rounded-lg px-2.5 py-1 text-[11px] font-semibold outline-none disabled:opacity-50"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </>
      )}
      {error && <span className="basis-full" style={{ color: "#f87171" }}>{error}</span>}
    </div>
  );
}

async function patchJson(url: string, body: unknown) {
  await requestJson(url, "PATCH", body);
}

async function postJson(url: string, body: unknown) {
  await requestJson(url, "POST", body);
}

async function requestJson(url: string, method: "PATCH" | "POST", body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null) as { error?: unknown } | null;
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Действие не выполнено");
  }
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
