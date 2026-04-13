"use client";
/**
 * @file AuditTab.tsx — app/(main)/settings
 *
 * Full audit log viewer: who changed what and when.
 * Admin-only — rendered only when the current user has role=admin.
 * Fetches from GET /api/audit with pagination and filters.
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AuditLogRow } from "@/shared/db/auditRepository";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditStats {
  total: number;
  today: number;
  byAction: Record<string, number>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
  CREATE:         { label: "Создано",    color: "#34d399", bg: "rgba(52,211,153,0.14)"  },
  UPDATE:         { label: "Изменено",   color: "#38bdf8", bg: "rgba(56,189,248,0.14)"  },
  DELETE:         { label: "Удалено",    color: "#f87171", bg: "rgba(239,68,68,0.14)"   },
  STATUS_CHANGE:  { label: "Статус",     color: "#a78bfa", bg: "rgba(139,92,246,0.14)"  },
  REORDER:        { label: "Порядок",    color: "#94a3b8", bg: "rgba(100,116,139,0.14)" },
  SUBTASK_TOGGLE: { label: "Подзадача",  color: "#fbbf24", bg: "rgba(251,191,36,0.14)"  },
  LOGIN:          { label: "Вход",       color: "#818cf8", bg: "rgba(99,102,241,0.14)"  },
};

const ENTITY_LABELS: Record<string, string> = {
  task:               "Задача",
  epic:               "Эпик",
  operative_task:     "Опер. задача",
  operative_subtask:  "Опер. подзадача",
  user:               "Пользователь",
  role:               "Роль",
  subtask:            "Подзадача",
};

const PAGE_SIZE = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z"));
  return d.toLocaleString("ru-RU", {
    day:    "2-digit",
    month:  "2-digit",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_META[action] ?? { label: action, color: "#94a3b8", bg: "rgba(100,116,139,0.14)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0"
      style={{
        background:   meta.bg,
        color:        meta.color,
        borderColor:  `${meta.color}30`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

function DetailsPill({ details }: { details: string | null }) {
  const [open, setOpen] = useState(false);
  if (!details) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(details) as Record<string, unknown>;
  } catch {
    return null;
  }

  const isEmpty = Object.keys(parsed).length === 0;
  if (isEmpty) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-[10px] font-mono px-2 py-0.5 rounded-md transition-colors"
        style={{
          background:  "var(--glass-02)",
          border:      "1px solid var(--glass-border)",
          color:       "var(--text-muted)",
        }}
      >
        {open ? "скрыть" : "детали"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.pre
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1 z-20 text-[10px] font-mono rounded-xl px-3 py-2.5 max-w-xs overflow-auto max-h-48"
            style={{
              background:  "var(--bg-surface)",
              border:      "1px solid var(--glass-border)",
              color:       "var(--text-secondary)",
              boxShadow:   "var(--shadow-overlay)",
              whiteSpace:  "pre-wrap",
              wordBreak:   "break-word",
            }}
          >
            {JSON.stringify(parsed, null, 2)}
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Stats row ─────────────────────────────────────────────────────────────────

function StatsRow({ stats }: { stats: AuditStats }) {
  const statItems = [
    { label: "Всего записей",   value: stats.total, color: "#a78bfa" },
    { label: "Сегодня",         value: stats.today, color: "#38bdf8" },
    { label: "Изменений",       value: stats.byAction.UPDATE ?? 0, color: "#34d399" },
    { label: "Удалений",        value: stats.byAction.DELETE ?? 0, color: "#f87171" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {statItems.map(s => (
        <div
          key={s.label}
          className="rounded-xl p-4"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</p>
          <p className="text-2xl font-bold font-mono mt-1" style={{ color: s.color }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

interface Filters {
  action: string;
  entityType: string;
  actorEmail: string;
}

function FilterBar({
  filters,
  onChange,
  onReset,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
}) {
  const hasActive = filters.action || filters.entityType || filters.actorEmail;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={filters.action}
        onChange={e => onChange({ action: e.target.value })}
        className="px-3 py-1.5 rounded-xl text-xs outline-none"
        style={{
          background: "var(--glass-01)",
          border:     "1px solid var(--glass-border)",
          color:      filters.action ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <option value="">Все действия</option>
        {Object.entries(ACTION_META).map(([k, v]) => (
          <option key={k} value={k} style={{ background: "var(--bg-elevated)" }}>{v.label}</option>
        ))}
      </select>

      <select
        value={filters.entityType}
        onChange={e => onChange({ entityType: e.target.value })}
        className="px-3 py-1.5 rounded-xl text-xs outline-none"
        style={{
          background: "var(--glass-01)",
          border:     "1px solid var(--glass-border)",
          color:      filters.entityType ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <option value="">Все объекты</option>
        {Object.entries(ENTITY_LABELS).map(([k, v]) => (
          <option key={k} value={k} style={{ background: "var(--bg-elevated)" }}>{v}</option>
        ))}
      </select>

      <input
        type="text"
        value={filters.actorEmail}
        onChange={e => onChange({ actorEmail: e.target.value })}
        placeholder="Фильтр по email..."
        className="px-3 py-1.5 rounded-xl text-xs outline-none w-48"
        style={{
          background: "var(--glass-01)",
          border:     "1px solid var(--glass-border)",
          color:      "var(--text-primary)",
        }}
      />

      {hasActive && (
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
          style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l8 8M10 2L2 10" />
          </svg>
          Сбросить
        </button>
      )}
    </div>
  );
}

// ── Log entry row ─────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: AuditLogRow }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 px-4 py-3 group"
      style={{ borderBottom: "1px solid var(--section-border)" }}
    >
      {/* Action badge */}
      <ActionBadge action={entry.action} />

      {/* Entity info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
            {entry.entityTitle ?? `#${entry.entityId}`}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: "var(--glass-02)", color: "var(--text-muted)" }}
          >
            {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
            {entry.actorEmail}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              background: entry.actorRole === "admin"
                ? "rgba(139,92,246,0.14)"
                : "rgba(100,116,139,0.14)",
              color: entry.actorRole === "admin" ? "#a78bfa" : "#94a3b8",
            }}
          >
            {entry.actorRole === "admin" ? "Администратор" : "Участник"}
          </span>
        </div>
      </div>

      {/* Right: details + timestamp */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {formatTs(entry.createdAt)}
        </span>
        <DetailsPill details={entry.details} />
      </div>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AuditTab() {
  const [entries,  setEntries]  = useState<AuditLogRow[]>([]);
  const [total,    setTotal]    = useState(0);
  const [stats,    setStats]    = useState<AuditStats | null>(null);
  const [page,     setPage]     = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    action:      "",
    entityType:  "",
    actorEmail:  "",
  });

  const fetchData = useCallback(async (pg: number, f: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String(pg * PAGE_SIZE),
      });
      if (f.action)      sp.set("action",      f.action);
      if (f.entityType)  sp.set("entityType",  f.entityType);
      if (f.actorEmail)  sp.set("actorEmail",  f.actorEmail);

      const res  = await fetch(`/api/audit?${sp.toString()}`);
      const json = await res.json() as {
        ok: boolean;
        data: AuditLogRow[];
        total: number;
        stats: AuditStats | null;
        error?: string;
      };

      if (!json.ok) {
        setError(json.error ?? "Ошибка загрузки журнала");
        return;
      }

      setEntries(json.data);
      setTotal(json.total);
      if (json.stats) setStats(json.stats);
    } catch {
      setError("Сетевая ошибка при загрузке журнала");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(0, filters);
    setPage(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handlePageChange = (p: number) => {
    setPage(p);
    void fetchData(p, filters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-4xl space-y-5">
      {/* Stats */}
      {stats && <StatsRow stats={stats} />}

      {/* Filters */}
      <FilterBar
        filters={filters}
        onChange={patch => setFilters(prev => ({ ...prev, ...patch }))}
        onReset={() => setFilters({ action: "", entityType: "", actorEmail: "" })}
      />

      {/* Error */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
        >
          {error}
        </div>
      )}

      {/* Log table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--glass-border)", background: "var(--glass-01)" }}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="var(--accent-400)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 4h10M3 8h7M3 12h5" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Журнал событий
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "var(--accent-glow)", color: "var(--accent-400)" }}>
              {total.toLocaleString("ru-RU")}
            </span>
          </div>
          <button
            onClick={() => void fetchData(page, filters)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors"
            style={{ background: "var(--glass-02)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}
          >
            <svg className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10 6A4 4 0 1 1 6 2" />
              <path d="M6 2l2-2M6 2l2 2" />
            </svg>
            Обновить
          </button>
        </div>

        {/* Rows */}
        {loading && entries.length === 0 ? (
          <div className="py-12 flex items-center justify-center gap-3" style={{ color: "var(--text-muted)" }}>
            <motion.div
              className="w-5 h-5 rounded-full border-2"
              style={{ borderColor: "var(--glass-border)", borderTopColor: "var(--accent-400)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            Загрузка...
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center" style={{ color: "var(--text-muted)" }}>
            <svg className="w-8 h-8 mx-auto mb-3 opacity-30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="16" cy="16" r="12" />
              <path d="M16 10v6l4 4" />
            </svg>
            <p className="text-sm">Записей не найдено</p>
            <p className="text-xs mt-1 opacity-60">Измените фильтры или дождитесь первых событий</p>
          </div>
        ) : (
          <div className={loading ? "opacity-60 pointer-events-none" : ""}>
            <AnimatePresence mode="popLayout">
              {entries.map(entry => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--glass-border)", background: "var(--glass-01)" }}
          >
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              Страница {page + 1} из {totalPages} · {total.toLocaleString("ru-RU")} записей
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0 || loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-xs disabled:opacity-40 transition-colors"
                style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
              >
                ‹
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                return (
                  <button
                    key={pg}
                    onClick={() => handlePageChange(pg)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all"
                    style={
                      pg === page
                        ? { background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.3)" }
                        : { background: "var(--glass-01)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }
                    }
                  >
                    {pg + 1}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages - 1 || loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-xs disabled:opacity-40 transition-colors"
                style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}