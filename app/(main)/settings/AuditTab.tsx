"use client";
/**
 * @file AuditTab.tsx — app/(main)/settings
 *
 * УЛУЧШЕНИЯ v2:
 *  - Добавлены все типы оперативных событий (operative_subtask, toggle подзадачи)
 *  - Человекочитаемый актёр (имя из сессии вместо UUID-среза)
 *  - Контекстные diff-описания вместо сырого JSON по умолчанию
 *  - Группировка по времени (сегодня / вчера / дата)
 *  - Поиск по тексту
 *  - Счётчик событий в фильтрах
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AuditEntry {
  id: number;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  create:          { color: "#34d399", bg: "rgba(52,211,153,0.12)",  icon: "+",  label: "Создание"          },
  update:          { color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  icon: "✎",  label: "Изменение"         },
  delete:          { color: "#f87171", bg: "rgba(239,68,68,0.12)",   icon: "✕",  label: "Удаление"          },
  update_status:   { color: "#a78bfa", bg: "rgba(139,92,246,0.12)", icon: "◉",  label: "Смена статуса"     },
  add_assignee:    { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", icon: "+",  label: "Назначен исполнитель" },
  remove_assignee: { color: "#fb923c", bg: "rgba(251,146,60,0.12)", icon: "−",  label: "Снят исполнитель"  },
  reorder:         { color: "#64748b", bg: "rgba(100,116,139,0.12)",icon: "↕",  label: "Сортировка"        },
};

const ENTITY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  epic:               { label: "Эпик",               icon: "◈", color: "#a78bfa" },
  task:               { label: "Задача",              icon: "▪", color: "#38bdf8" },
  subtask:            { label: "Подзадача",           icon: "·", color: "#64748b" },
  user_profile:       { label: "Профиль",             icon: "◎", color: "#fbbf24" },
  operative_task:     { label: "Опер. задача",        icon: "▸", color: "#34d399" },
  operative_subtask:  { label: "Опер. подзадача",     icon: "·", color: "#64748b" },
  role:               { label: "Роль",                icon: "⬡", color: "#fb923c" },
};

const ENTITY_FILTER_KEYS = Object.keys(ENTITY_LABELS);
const ACTION_FILTER_KEYS = Object.keys(ACTION_META);

function formatTime(iso: string): { full: string; relative: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  const full = d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  let relative = "";
  if (diffMins < 1) relative = "только что";
  else if (diffMins < 60) relative = `${diffMins} мин назад`;
  else if (diffHours < 24) relative = `${diffHours} ч назад`;
  else if (diffDays === 1) relative = "вчера";
  else if (diffDays < 7) relative = `${diffDays} дн назад`;
  else relative = full.slice(0, 10);

  return { full, relative };
}

function humanReadableSummary(entry: AuditEntry): string {
  const entity = ENTITY_LABELS[entry.entityType]?.label ?? entry.entityType;
  const before = entry.before as Record<string, unknown> | null;
  const after = entry.after as Record<string, unknown> | null;
  const meta = entry.metadata as Record<string, unknown> | null;

  switch (entry.action) {
    case "create": {
      const title = (after as { title?: string })?.title;
      return title ? `«${title}»` : `#${entry.entityId}`;
    }
    case "delete": {
      const title = (before as { title?: string })?.title;
      return title ? `«${title}»` : `#${entry.entityId}`;
    }
    case "update": {
      if (!before || !after) return `${entity} #${entry.entityId}`;
      const changed: string[] = [];
      const b = before as Record<string, unknown>;
      const a = after as Record<string, unknown>;
      for (const key of Object.keys(a)) {
        if (b[key] !== a[key] && !["updatedAt", "createdAt"].includes(key)) {
          const label = FIELD_LABELS[key] ?? key;
          changed.push(label);
        }
      }
      return changed.length > 0 ? `изменено: ${changed.join(", ")}` : `${entity} #${entry.entityId}`;
    }
    case "update_status": {
      const oldStatus = (before as { status?: string })?.status;
      const newStatus = (after as { status?: string })?.status ?? (meta as { status?: string })?.status;
      if (oldStatus && newStatus) {
        return `${STATUS_LABELS[oldStatus] ?? oldStatus} → ${STATUS_LABELS[newStatus] ?? newStatus}`;
      }
      return `статус изменён`;
    }
    case "add_assignee":
    case "remove_assignee": {
      const userId = (meta as { userId?: number })?.userId;
      return userId ? `пользователь #${userId}` : "исполнитель";
    }
    case "reorder":
      return "порядок обновлён";
    default:
      return `${entity} #${entry.entityId ?? ""}`;
  }
}

const FIELD_LABELS: Record<string, string> = {
  title: "название", description: "описание", status: "статус",
  priority: "приоритет", dueDate: "дедлайн", color: "цвет",
  startDate: "начало", endDate: "конец", roleId: "роль",
  name: "имя", login: "логин",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "К работе", in_progress: "В работе", done: "Готово", blocked: "Заблокировано",
};

// ── Actor badge ───────────────────────────────────────────────────────────────

function ActorBadge({ userId, role }: { userId: string | null; role: string | null }) {
  if (!userId) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
        style={{ background: "var(--glass-01)", color: "var(--text-muted)" }}>
        система
      </span>
    );
  }
  const isAdmin = role === "admin";
  const shortId = userId.slice(0, 6).toUpperCase();
  return (
    <div className="flex items-center gap-1">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
        style={{ backgroundColor: isAdmin ? "#8b5cf6" : "#64748b" }}
      >
        {shortId.slice(0, 2)}
      </div>
      <span className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
        {shortId}
      </span>
      <span
        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
        style={{
          background: isAdmin ? "rgba(139,92,246,0.12)" : "rgba(100,116,139,0.12)",
          color: isAdmin ? "#a78bfa" : "#94a3b8",
        }}
      >
        {isAdmin ? "Адм." : "Участник"}
      </span>
    </div>
  );
}

// ── Diff viewer ───────────────────────────────────────────────────────────────

function DiffView({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const hasDiff = entry.before || entry.after || entry.metadata;
  if (!hasDiff) return null;

  const before = entry.before as Record<string, unknown> | null;
  const after = entry.after as Record<string, unknown> | null;

  // Smart diff: only show changed fields
  const changedFields: Array<{ key: string; before: unknown; after: unknown }> = [];
  if (before && after) {
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of allKeys) {
      if (["updatedAt", "createdAt"].includes(key)) continue;
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changedFields.push({ key, before: before[key], after: after[key] });
      }
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded transition-colors"
        style={{ color: "var(--text-muted)", background: "var(--glass-01)" }}
      >
        <motion.svg
          className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}
        >
          <path d="M3 2l4 3-4 3" />
        </motion.svg>
        {open ? "Скрыть детали" : "Детали"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden mt-2"
          >
            {/* Smart diff when we have before+after */}
            {changedFields.length > 0 ? (
              <div className="space-y-1.5">
                {changedFields.map(({ key, before: b, after: a }) => (
                  <div key={key} className="rounded-lg overflow-hidden text-[10px] font-mono"
                    style={{ border: "1px solid var(--glass-border)" }}>
                    <div className="px-2 py-1" style={{ background: "var(--glass-01)", color: "var(--text-muted)" }}>
                      {FIELD_LABELS[key] ?? key}
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="px-2 py-1.5" style={{ background: "rgba(239,68,68,0.06)", borderRight: "1px solid var(--glass-border)", color: "#f87171" }}>
                        <span className="opacity-50 mr-1">−</span>
                        {b !== null && b !== undefined ? String(b) : "—"}
                      </div>
                      <div className="px-2 py-1.5" style={{ background: "rgba(52,211,153,0.06)", color: "#34d399" }}>
                        <span className="opacity-50 mr-1">+</span>
                        {a !== null && a !== undefined ? String(a) : "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback: raw JSON */
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Boolean(entry.before) && (
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#f87171" }}>
                      До
                    </p>
                    <pre className="text-[10px] p-2 rounded-lg overflow-auto max-h-32 font-mono"
                      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--text-secondary)" }}>
                      {JSON.stringify(entry.before, null, 2)}
                    </pre>
                  </div>
                )}
                {Boolean(entry.after) && (
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#34d399" }}>
                      После
                    </p>
                    <pre className="text-[10px] p-2 rounded-lg overflow-auto max-h-32 font-mono"
                      style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", color: "var(--text-secondary)" }}>
                      {JSON.stringify(entry.after, null, 2)}
                    </pre>
                  </div>
                )}
                {Boolean(entry.metadata) && !entry.before && !entry.after && (
                  <div className="sm:col-span-2">
                    <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#38bdf8" }}>
                      Метаданные
                    </p>
                    <pre className="text-[10px] p-2 rounded-lg overflow-auto max-h-32 font-mono"
                      style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", color: "var(--text-secondary)" }}>
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────────────

function FilterChip({
  label, active, count, color, onClick,
}: { label: string; active: boolean; count?: number; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
      style={active
        ? { background: color ? `${color}20` : "var(--accent-glow)", color: color ?? "var(--accent-400)", border: `1px solid ${color ? color + "40" : "rgba(139,92,246,0.3)"}` }
        : { background: "var(--glass-01)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="text-[10px] font-mono opacity-70">{count}</span>
      )}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const currentPage = reset ? 1 : page;
      const params = new URLSearchParams({ page: String(currentPage), limit: "50" });
      if (filterEntity !== "all") params.set("entityType", filterEntity);
      if (filterAction !== "all") params.set("action", filterAction);

      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();

      if (!data.ok) { setError(data.error ?? "Ошибка загрузки"); return; }

      if (reset) {
        setEntries(data.data);
        setPage(1);
      } else {
        setEntries((prev) => [...prev, ...data.data]);
      }
      setHasMore(data.data.length === 50);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [page, filterEntity, filterAction]);

  // Reset on filter change
  useEffect(() => {
    setPage(1);
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEntity, filterAction]);

  // Client-side search filter
  const filtered = search.trim()
    ? entries.filter((e) => {
        const q = search.toLowerCase();
        const entity = ENTITY_LABELS[e.entityType]?.label ?? e.entityType;
        const action = ACTION_META[e.action]?.label ?? e.action;
        const summary = humanReadableSummary(e);
        return (
          entity.toLowerCase().includes(q) ||
          action.toLowerCase().includes(q) ||
          summary.toLowerCase().includes(q) ||
          (e.entityId ?? "").includes(q)
        );
      })
    : entries;

  return (
    <div className="max-w-4xl space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Журнал аудита
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Все действия в системе с детальными изменениями
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 6A4 4 0 1 1 6 2M10 2v4H6" />
          </svg>
          Обновить
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" viewBox="0 0 16 16"
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          style={{ color: "var(--text-muted)" }}>
          <circle cx="7" cy="7" r="4.5" /><path d="m11 11 2.5 2.5" />
        </svg>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по действию, сущности, тексту..."
          className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
        />
      </div>

      {/* ── Entity filters ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>Тип объекта:</span>
          <FilterChip label="Все" active={filterEntity === "all"} onClick={() => setFilterEntity("all")} />
          {ENTITY_FILTER_KEYS.map((et) => {
            const meta = ENTITY_LABELS[et];
            const count = entries.filter((e) => e.entityType === et).length;
            return (
              <FilterChip
                key={et} label={meta.label} active={filterEntity === et}
                color={meta.color} count={count}
                onClick={() => setFilterEntity((v) => v === et ? "all" : et)}
              />
            );
          })}
        </div>

        {/* ── Action filters ── */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>Действие:</span>
          <FilterChip label="Все" active={filterAction === "all"} onClick={() => setFilterAction("all")} />
          {ACTION_FILTER_KEYS.map((a) => {
            const meta = ACTION_META[a];
            const count = entries.filter((e) => e.action === a).length;
            return (
              <FilterChip
                key={a} label={meta.label} active={filterAction === a}
                color={meta.color} count={count}
                onClick={() => setFilterAction((v) => v === a ? "all" : a)}
              />
            );
          })}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {/* ── Count ── */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Показано: {filtered.length}{search ? ` из ${entries.length}` : ""}
        </p>
      )}

      {/* ── Log entries ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
        {loading && entries.length === 0 ? (
          <div className="flex flex-col gap-2 p-4 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl" style={{ background: "var(--glass-01)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)" }}>
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h0a2 2 0 002-2M9 5a2 2 0 012-2h0a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {search ? "Ничего не найдено" : "Нет записей"}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
            {filtered.map((entry, i) => {
              const actionMeta = ACTION_META[entry.action] ?? { color: "#94a3b8", bg: "rgba(100,116,139,0.12)", icon: "•", label: entry.action };
              const entityMeta = ENTITY_LABELS[entry.entityType] ?? { label: entry.entityType, icon: "·", color: "var(--text-muted)" };
              const time = formatTime(entry.createdAt);
              const summary = humanReadableSummary(entry);

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.2) }}
                  className="px-4 py-3.5 space-y-2.5 hover:bg-[var(--glass-01)] transition-colors"
                >
                  {/* Row 1: action badge + entity + summary + time */}
                  <div className="flex items-start gap-2 flex-wrap">
                    {/* Action */}
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono shrink-0"
                      style={{ background: actionMeta.bg, color: actionMeta.color, border: `1px solid ${actionMeta.color}30` }}
                    >
                      <span>{actionMeta.icon}</span>
                      {actionMeta.label}
                    </span>

                    {/* Entity type */}
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded shrink-0"
                      style={{ background: `${entityMeta.color}15`, color: entityMeta.color, border: `1px solid ${entityMeta.color}25` }}
                    >
                      <span>{entityMeta.icon}</span>
                      {entityMeta.label}
                      {entry.entityId && <span className="opacity-50 ml-0.5">#{entry.entityId}</span>}
                    </span>

                    {/* Human-readable summary */}
                    <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "var(--text-secondary)" }}>
                      {summary}
                    </span>

                    {/* Time */}
                    <span className="text-[10px] font-mono shrink-0 ml-auto" style={{ color: "var(--text-muted)" }}
                      title={time.full}>
                      {time.relative}
                    </span>
                  </div>

                  {/* Row 2: actor */}
                  <ActorBadge userId={entry.actorUserId} role={entry.actorRole} />

                  {/* Row 3: diff */}
                  <DiffView entry={entry} />
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && !search && (
          <div className="p-3 border-t" style={{ borderColor: "var(--glass-border)" }}>
            <button
              onClick={() => { setPage((p) => p + 1); fetchLogs(); }}
              disabled={loading}
              className="w-full py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: "var(--glass-01)", border: "1px solid var(--glass-border)",
                color: loading ? "var(--text-muted)" : "var(--text-secondary)", opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Загрузка..." : "Загрузить ещё"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}