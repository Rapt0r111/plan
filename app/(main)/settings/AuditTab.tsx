"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type JsonRecord = Record<string, unknown>;

interface AuditEntry {
  id: number;
  actorUserId: string | null;
  actorName: string | null;
  actorLogin: string | null;
  actorInitials: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; tone: string }> = {
  create: { label: "Создание", tone: "success" },
  update: { label: "Изменение", tone: "info" },
  delete: { label: "Удаление", tone: "danger" },
  update_status: { label: "Смена статуса", tone: "accent" },
  update_due_date: { label: "Срок", tone: "warning" },
  create_subtask: { label: "Подзадача", tone: "success" },
  toggle_subtask: { label: "Статус подзадачи", tone: "accent" },
  comment: { label: "Комментарий", tone: "info" },
  add_assignee: { label: "Назначение", tone: "warning" },
  remove_assignee: { label: "Снятие исполнителя", tone: "warning" },
  reorder: { label: "Сортировка", tone: "neutral" },
  force_password_change: { label: "Смена пароля", tone: "danger" },
};

const ENTITY_LABELS: Record<string, string> = {
  epic: "Эпик",
  task: "Задача",
  subtask: "Подзадача",
  user_profile: "Профиль",
  auth_user: "Аккаунт",
  operative_task: "Оперативная задача",
  operative_subtask: "Оперативная подзадача",
  role: "Роль",
  personnel_group: "Группа",
  personal_plan_item: "Личный план",
  app_settings: "Настройки",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Название",
  description: "Описание",
  status: "Статус",
  priority: "Приоритет",
  dueDate: "Срок",
  startDate: "Начало",
  endDate: "Конец",
  name: "Имя",
  login: "Логин",
  roleId: "Роль",
  accountStatus: "Статус аккаунта",
  forcePasswordChange: "Обязательная смена пароля",
  blockOrder: "Порядок",
  sortOrder: "Порядок",
  color: "Цвет",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "К работе",
  in_progress: "В работе",
  done: "Готово",
  blocked: "Заблокировано",
  active: "Активен",
  invited: "Приглашён",
  disabled: "Отключён",
};

const TONE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  success: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.28)", text: "#34d399" },
  info: { bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.28)", text: "#38bdf8" },
  danger: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.28)", text: "#f87171" },
  warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.28)", text: "#fbbf24" },
  accent: { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.28)", text: "#a78bfa" },
  neutral: { bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.22)", text: "#94a3b8" },
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function parseAuditDate(value: string): Date {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date(value) : date;
}

function formatDateTime(value: string) {
  const date = parseAuditDate(value);
  return {
    day: date.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" }),
    time: date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    full: date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "не указано";
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (typeof value === "string") return STATUS_LABELS[value] ?? value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function changedFields(entry: AuditEntry) {
  const before = asRecord(entry.before);
  const after = asRecord(entry.after);
  if (!before || !after) return [];

  const ignored = new Set(["createdAt", "updatedAt"]);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !ignored.has(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
}

function pickTitle(value: unknown): string | null {
  const record = asRecord(value);
  const title = record?.title ?? record?.name ?? record?.login;
  return typeof title === "string" && title.trim() ? title : null;
}

function summaryFor(entry: AuditEntry): string {
  const before = asRecord(entry.before);
  const after = asRecord(entry.after);
  const meta = asRecord(entry.metadata);
  const entity = ENTITY_LABELS[entry.entityType] ?? entry.entityType;

  if (entry.action === "update") {
    const fields = changedFields(entry).map((field) => FIELD_LABELS[field.key] ?? field.key);
    return fields.length ? `Изменено: ${fields.join(", ")}` : `${entity} #${entry.entityId ?? ""}`;
  }

  if (entry.action === "update_status") {
    const from = before?.status;
    const to = after?.status ?? asRecord(meta?.status)?.to ?? meta?.status;
    return `${formatValue(from)} → ${formatValue(to)}`;
  }

  if (entry.action === "update_due_date") {
    const dueDate = asRecord(meta?.dueDate);
    return `${formatValue(dueDate?.from ?? before?.dueDate)} → ${formatValue(dueDate?.to ?? after?.dueDate)}`;
  }

  if (entry.action === "create" || entry.action === "create_subtask") {
    return pickTitle(entry.after) ?? `${entity} #${entry.entityId ?? ""}`;
  }

  if (entry.action === "delete") {
    return pickTitle(entry.before) ?? `${entity} #${entry.entityId ?? ""}`;
  }

  if (entry.action === "toggle_subtask") {
    return after?.isCompleted ? "Подзадача выполнена" : "Подзадача возвращена в работу";
  }

  if (entry.action === "comment") return "Добавлен комментарий";
  if (entry.action === "reorder") return "Обновлён порядок отображения";

  return `${entity}${entry.entityId ? ` #${entry.entityId}` : ""}`;
}

function Actor({ entry }: { entry: AuditEntry }) {
  const isSystem = !entry.actorUserId;
  const name = entry.actorName ?? entry.actorLogin ?? (isSystem ? "Система" : "Неизвестный пользователь");
  const login = entry.actorLogin && entry.actorLogin !== name ? `@${entry.actorLogin}` : null;
  const initials = entry.actorInitials || name.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ background: entry.actorRole === "admin" ? "#7c3aed" : "#475569" }}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {name}
        </div>
        <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
          {login ?? (entry.actorRole === "admin" ? "Администратор" : "Участник")}
        </div>
      </div>
    </div>
  );
}

function Details({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const fields = changedFields(entry);
  const hasDetails = fields.length > 0 || entry.before || entry.after || entry.metadata;
  if (!hasDetails) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg px-2.5 py-1 text-xs transition-colors"
        style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
      >
        {open ? "Скрыть детали" : "Показать детали"}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {fields.length > 0 ? (
            fields.map((field) => (
              <div key={field.key} className="rounded-lg p-3" style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}>
                <div className="mb-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {FIELD_LABELS[field.key] ?? field.key}
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-md px-2 py-1.5" style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5" }}>
                    Было: {formatValue(field.before)}
                  </div>
                  <div className="rounded-md px-2 py-1.5" style={{ background: "rgba(16,185,129,0.08)", color: "#6ee7b7" }}>
                    Стало: {formatValue(field.after)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <pre className="max-h-64 overflow-auto rounded-lg p-3 text-xs" style={{ background: "var(--glass-01)", color: "var(--text-secondary)" }}>
              {JSON.stringify({ before: entry.before, after: entry.after, metadata: entry.metadata }, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  const style = TONE_STYLES[tone] ?? TONE_STYLES.neutral;
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.text }}>
      {children}
    </span>
  );
}

export function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(
    async (reset = false, pageOverride?: number) => {
      setLoading(true);
      setError(null);
      try {
        const currentPage = reset ? 1 : pageOverride ?? 1;
        const params = new URLSearchParams({ page: String(currentPage), limit: "50", _ts: String(Date.now()) });
        if (entityFilter !== "all") params.set("entityType", entityFilter);
        if (actionFilter !== "all") params.set("action", actionFilter);

        const response = await fetch(`/api/audit-logs?${params}`, { cache: "no-store" });
        const payload = await response.json();
        if (!payload.ok) throw new Error(payload.error ?? "Не удалось загрузить аудит");

        setEntries((previous) => (reset ? payload.data : [...previous, ...payload.data]));
        setPage(currentPage);
        setHasMore(payload.data.length === 50);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Ошибка загрузки аудита");
      } finally {
        setLoading(false);
      }
    },
    [actionFilter, entityFilter],
  );

  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") fetchLogs(true);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchLogs]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => {
      const text = [
        entry.actorName,
        entry.actorLogin,
        entry.action,
        ACTION_META[entry.action]?.label,
        entry.entityType,
        ENTITY_LABELS[entry.entityType],
        entry.entityId,
        summaryFor(entry),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(query);
    });
  }, [entries, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const entry of filtered) {
      const key = formatDateTime(entry.createdAt).day;
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Журнал аудита
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Кто, когда и что изменил в системе.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchLogs(true)}
          className="rounded-lg px-3 py-2 text-sm font-medium"
          style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
        >
          Обновить
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_220px_220px]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по пользователю, действию или объекту"
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
        />
        <select
          value={entityFilter}
          onChange={(event) => setEntityFilter(event.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
        >
          <option value="all">Все объекты</option>
          {Object.entries(ENTITY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
        >
          <option value="all">Все действия</option>
          {Object.entries(ACTION_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      <div className="rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
        {loading && entries.length === 0 ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-lg" style={{ background: "var(--glass-01)" }} />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Записей аудита не найдено
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
            {grouped.map(([day, dayEntries]) => (
              <section key={day}>
                <div className="sticky top-0 z-10 px-4 py-2 text-xs font-semibold uppercase" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                  {day}
                </div>
                <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
                  {dayEntries.map((entry) => {
                    const action = ACTION_META[entry.action] ?? { label: entry.action, tone: "neutral" };
                    const entity = ENTITY_LABELS[entry.entityType] ?? entry.entityType;
                    const time = formatDateTime(entry.createdAt);
                    return (
                      <article key={entry.id} className="grid gap-3 p-4 md:grid-cols-[180px_1fr_86px]">
                        <Actor entry={entry} />
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Chip tone={action.tone}>{action.label}</Chip>
                            <Chip>
                              {entity}
                              {entry.entityId ? ` #${entry.entityId}` : ""}
                            </Chip>
                          </div>
                          <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                            {summaryFor(entry)}
                          </div>
                          <Details entry={entry} />
                        </div>
                        <div className="text-left md:text-right">
                          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }} title={time.full}>
                            {time.time}
                          </div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            #{entry.id}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {hasMore && !search && (
          <div className="border-t p-3" style={{ borderColor: "var(--glass-border)" }}>
            <button
              type="button"
              onClick={() => fetchLogs(false, page + 1)}
              disabled={loading}
              className="w-full rounded-lg py-2 text-sm font-medium"
              style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", opacity: loading ? 0.65 : 1 }}
            >
              {loading ? "Загрузка..." : "Загрузить ещё"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
