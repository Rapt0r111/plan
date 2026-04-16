"use client";
/**
 * @file AuditTab.tsx — app/(main)/settings
 * Shows full audit log with filtering by entity type and action.
 * Admin-only — server already enforces this on the API.
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

const ACTION_META: Record<string, { color: string; bg: string; icon: string }> = {
  create: { color: "#34d399", bg: "rgba(52,211,153,0.12)", icon: "+" },
  update: { color: "#38bdf8", bg: "rgba(56,189,248,0.12)", icon: "✎" },
  delete: { color: "#f87171", bg: "rgba(239,68,68,0.12)", icon: "✕" },
  update_status: { color: "#a78bfa", bg: "rgba(139,92,246,0.12)", icon: "◉" },
  add_assignee: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)", icon: "+" },
  remove_assignee: { color: "#fb923c", bg: "rgba(251,146,60,0.12)", icon: "−" },
  reorder: { color: "#64748b", bg: "rgba(100,116,139,0.12)", icon: "↕" },
};

const ENTITY_LABELS: Record<string, string> = {
  epic: "Эпик",
  task: "Задача",
  subtask: "Подзадача",
  user_profile: "Профиль",
  operative_task: "Оперативная задача",
  role: "Роль",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  update_status: "Статус",
  add_assignee: "Добавлен исполнитель",
  remove_assignee: "Убран исполнитель",
  reorder: "Сортировка",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_META[action] ?? { color: "#94a3b8", bg: "rgba(100,116,139,0.12)", icon: "•" };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono shrink-0"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}
    >
      <span>{meta.icon}</span>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

function EntityBadge({ entityType }: { entityType: string }) {
  return (
    <span
      className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
      style={{ background: "var(--glass-02)", color: "var(--text-secondary)" }}
    >
      {ENTITY_LABELS[entityType] ?? entityType}
    </span>
  );
}

function DiffView({ before, after }: { before: unknown; after: unknown }) {
  const [open, setOpen] = useState(false);
  if (!before && !after) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded transition-colors"
        style={{ color: "var(--text-muted)", background: "var(--glass-01)" }}
      >
        <motion.svg
          className="w-2.5 h-2.5"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <path d="M3 2l4 3-4 3" />
        </motion.svg>
        {open ? "Скрыть" : "Детали"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Boolean(before) && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#f87171" }}>
                    До
                  </p>
                  <pre
                    className="text-[10px] p-2 rounded-lg overflow-auto max-h-32 font-mono"
                    style={{
                      background: "rgba(239,68,68,0.06)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {JSON.stringify(before, null, 2)}
                  </pre>
                </div>
              )}
              {Boolean(after) && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#34d399" }}>
                    После
                  </p>
                  <pre
                    className="text-[10px] p-2 rounded-lg overflow-auto max-h-32 font-mono"
                    style={{
                      background: "rgba(52,211,153,0.06)",
                      border: "1px solid rgba(52,211,153,0.2)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {JSON.stringify(after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  "epic", "task", "subtask", "user_profile", "operative_task", "role",
] as const;

const ACTIONS = [
  "create", "update", "delete", "update_status", "add_assignee", "remove_assignee", "reorder",
] as const;

// ── Main ──────────────────────────────────────────────────────────────────────

export function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (filterEntity !== "all") params.set("entityType", filterEntity);
      if (filterAction !== "all") params.set("action", filterAction);

      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();

      if (!data.ok) {
        setError(data.error ?? "Ошибка загрузки");
        return;
      }

      setEntries(page === 1 ? data.data : (prev) => [...prev, ...data.data]);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [page, filterEntity, filterAction]);

  useEffect(() => {
    setPage(1);
    setEntries([]);
  }, [filterEntity, filterAction]);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterEntity, filterAction]);

  return (
    <div className="max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Журнал аудита
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Все действия в системе
          </p>
        </div>

        <button
          onClick={() => { setPage(1); setEntries([]); fetchLogs(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 6A4 4 0 1 1 6 2M10 2v4H6" />
          </svg>
          Обновить
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Тип:</span>
          <button
            onClick={() => setFilterEntity("all")}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={filterEntity === "all"
              ? { background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.3)" }
              : { background: "var(--glass-01)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}
          >
            Все
          </button>
          {ENTITY_TYPES.map((et) => (
            <button
              key={et}
              onClick={() => setFilterEntity(et)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={filterEntity === et
                ? { background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.3)" }
                : { background: "var(--glass-01)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}
            >
              {ENTITY_LABELS[et] ?? et}
            </button>
          ))}
        </div>

        <div className="w-full h-px" style={{ background: "var(--glass-border)" }} />

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Действие:</span>
          <button
            onClick={() => setFilterAction("all")}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={filterAction === "all"
              ? { background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.3)" }
              : { background: "var(--glass-01)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}
          >
            Все
          </button>
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setFilterAction(a)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={filterAction === a
                ? { background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.3)" }
                : { background: "var(--glass-01)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}
            >
              {ACTION_LABELS[a] ?? a}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
        >
          {error}
        </div>
      )}

      {/* Log entries */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
      >
        {loading && entries.length === 0 ? (
          <div className="flex flex-col gap-2 p-4 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl" style={{ background: "var(--glass-01)" }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)" }}
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h0a2 2 0 002-2M9 5a2 2 0 012-2h0a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Нет записей</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="px-4 py-3 space-y-2 hover:bg-[var(--glass-01)] transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <ActionBadge action={entry.action} />
                  <EntityBadge entityType={entry.entityType} />
                  {entry.entityId && (
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                      #{entry.entityId}
                    </span>
                  )}
                  <div className="flex-1" />
                  <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
                    {formatTime(entry.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {entry.actorUserId && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: entry.actorRole === "admin" ? "#8b5cf6" : "#64748b" }}
                      >
                        {entry.actorUserId.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                        {entry.actorUserId.slice(0, 8)}…
                      </span>
                      {entry.actorRole && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: entry.actorRole === "admin" ? "rgba(139,92,246,0.12)" : "rgba(100,116,139,0.12)",
                            color: entry.actorRole === "admin" ? "#a78bfa" : "#94a3b8",
                          }}
                        >
                          {entry.actorRole === "admin" ? "Администратор" : "Участник"}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <DiffView before={entry.before} after={entry.after} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Load more */}
        {entries.length > 0 && entries.length % 50 === 0 && (
          <div className="p-3 border-t" style={{ borderColor: "var(--glass-border)" }}>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
              className="w-full py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: "var(--glass-01)",
                border: "1px solid var(--glass-border)",
                color: loading ? "var(--text-muted)" : "var(--text-secondary)",
                opacity: loading ? 0.6 : 1,
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