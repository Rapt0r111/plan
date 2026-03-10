"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useRoleStore } from "@/shared/store/useRoleStore";
import { cn } from "@/shared/lib/utils";
// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleLoad {
  role: string;
  label: string;
  hex: string;
  total: number;
  pending: number;
  /** Normalised 0–1 relative to the most loaded role */
  energy: number;
}

interface Suggestion {
  from: string;
  to: string;
  count: number;
  reason: string;
}

type Phase = "idle" | "analyzing" | "result" | "applied";

const ANALYZE_DURATION = 1800;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleColor(hex: string, energy: number): string {
  if (energy >= 0.75) return "#f87171"; // high load → red
  if (energy >= 0.5) return "#fb923c"; // moderate → orange
  if (energy >= 0.25) return "#facc15"; // low-moderate → yellow
  return hex;                            // calm → role colour
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface LoadBarProps {
  load: RoleLoad;
  index: number;
  isMax: boolean;
}

function LoadBar({ load, index, isMax }: LoadBarProps) {
  const barColor = getRoleColor(load.hex, load.energy);
  const pct = load.energy * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="flex items-center gap-2.5"
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: barColor }}
      />
      <span className="text-xs text-[var(--text-secondary)] w-32 shrink-0 truncate">
        {load.label}
      </span>
      <div className="flex-1 h-1.5 bg-[var(--glass-02)] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: index * 0.05, ease: "easeOut" }}
        />
      </div>
      <span
        className={cn(
          "text-xs font-mono w-5 text-right shrink-0",
          isMax && load.pending > 0 ? "font-bold" : "text-(--text-muted)"
        )}
        style={isMax && load.pending > 0 ? { color: barColor } : undefined}
      >
        {load.pending}
      </span>
    </motion.div>
  );
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  index: number;
}

function SuggestionCard({ suggestion, index }: SuggestionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-xl p-3 space-y-1.5"
      style={{
        background: "rgba(139,92,246,0.06)",
        border: "1px solid rgba(139,92,246,0.18)",
      }}
    >
      {suggestion.count > 0 ? (
        <>
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
            <span className="text-[var(--accent-400)]">{suggestion.from}</span>
            <svg
              className="w-3 h-3 text-[var(--text-muted)]"
              viewBox="0 0 12 12" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round"
            >
              <path d="M1 6h10M7 2l4 4-4 4" />
            </svg>
            <span className="text-emerald-400">{suggestion.to}</span>
            <span className="ml-auto font-mono text-[var(--accent-300)]">
              {suggestion.count} задач
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{suggestion.reason}</p>
        </>
      ) : (
        <p className="text-xs text-[var(--text-secondary)]">{suggestion.reason}</p>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WorkloadBalancer() {
  const epics = useTaskStore((s) => s.epics);
  const roles = useRoleStore((s) => s.roles);
  const [phase, setPhase] = useState<Phase>("idle");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);

  const loads = useMemo<RoleLoad[]>(() => {
    const map = new Map<string, { label: string; hex: string; total: number; pending: number }>();

    for (const role of roles) {
      map.set(role.key, { label: role.label, hex: role.hex, total: 0, pending: 0 });
    }

    for (const epic of epics) {
      for (const task of epic.tasks ?? []) {
        for (const assignee of task.assignees ?? []) {
          const key = assignee.roleMeta.key; // ← ВОТ ОНО

          const entry = map.get(key);
          if (!entry) continue;

          entry.total++;
          if (task.status !== "done") entry.pending++;
        }
      }
    }

    const maxPending = Math.max(...[...map.values()].map((v) => v.pending), 1);

    return [...map.entries()].map(([role, v]) => ({
      role,
      label: v.label,
      hex: v.hex,
      total: v.total,
      pending: v.pending,
      energy: v.pending / maxPending,
    }));
  }, [epics, roles]);

  const maxCount = Math.max(...loads.map((l) => l.pending), 1);
  const totalAssigned = loads.reduce((s, l) => s + l.total, 0);
  const activeRoles = loads.filter((l) => l.total > 0).length;

  function runAnalysis() {
    setPhase("analyzing");
    setTimeout(() => {
      const overloaded = loads.filter((l) => l.pending >= 4);
      const underloaded = loads.filter(
        (l) => l.pending <= 1 && l.pending < (overloaded[0]?.pending ?? 0)
      );

      const result: Suggestion[] = [];
      if (overloaded.length > 0 && underloaded.length > 0) {
        result.push({
          from: overloaded[0].label,
          to: underloaded[0].label,
          count: Math.floor((overloaded[0].pending - underloaded[0].pending) / 2),
          reason: `Разница в нагрузке: ${overloaded[0].pending} vs ${underloaded[0].pending} задач`,
        });
      }
      if (overloaded.length > 1 && underloaded.length > 1) {
        result.push({
          from: overloaded[1].label,
          to: underloaded[1]?.label ?? underloaded[0].label,
          count: 2,
          reason: "Приближается дедлайн, рекомендуется делегировать",
        });
      }
      if (result.length === 0) {
        result.push({
          from: "—",
          to: "—",
          count: 0,
          reason: "Нагрузка распределена равномерно. Изменения не требуются.",
        });
      }

      setSuggestions(result);
      setPhase("result");
    }, ANALYZE_DURATION);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
    >
      {/* ── Header / Toggle ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
        style={{ borderBottom: open ? "1px solid var(--glass-border)" : "none" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-glow)", border: "1px solid rgba(139,92,246,0.3)" }}
        >
          <svg className="w-3.5 h-3.5 text-[var(--accent-400)]" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 12h2v-2H2v2zm0-4h2V6H2v2zm0-4h2V2H2v2zm4 8h8v-2H6v2zm0-4h8V6H6v2zm0-4h8V2H6v2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Балансировка нагрузки
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {totalAssigned} задач · {activeRoles} ролей
          </p>
        </div>
        <motion.svg
          className="w-4 h-4 text-[var(--text-muted)] shrink-0"
          viewBox="0 0 16 16" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path d="M4 6l4 4 4-4" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 space-y-4">
              {/* ── Load bars ── */}
              <div className="space-y-2">
                {loads.map((load, idx) => (
                  <LoadBar
                    key={load.role}
                    load={load}
                    index={idx}
                    isMax={load.pending === maxCount}
                  />
                ))}
              </div>

              {/* ── Analyze button ── */}
              {phase === "idle" && (
                <button
                  onClick={runAnalysis}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{
                    background: "var(--accent-glow)",
                    color: "var(--accent-400)",
                    border: "1px solid rgba(139,92,246,0.3)",
                  }}
                >
                  <svg
                    className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  >
                    <path d="M8 1v14M1 8h14" />
                    <circle cx="8" cy="8" r="6" />
                  </svg>
                  Предложить балансировку
                </button>
              )}

              {/* ── Analyzing state ── */}
              {phase === "analyzing" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-3 py-3"
                >
                  <svg className="w-4 h-4 text-[var(--accent-400)] animate-spin" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="rgba(139,92,246,0.25)" strokeWidth="2" />
                    <path d="M8 2a6 6 0 0 1 6 6" stroke="var(--accent-400)" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="text-sm text-[var(--text-secondary)]">
                    Анализирую нагрузку...
                  </span>
                </motion.div>
              )}

              {/* ── Results ── */}
              <AnimatePresence>
                {phase === "result" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="space-y-2"
                  >
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest">
                      Рекомендации
                    </p>
                    {suggestions.map((s, i) => (
                      <SuggestionCard key={i} suggestion={s} index={i} />
                    ))}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setPhase("applied")}
                        className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                        style={{
                          background: "rgba(52,211,153,0.12)",
                          color: "#34d399",
                          border: "1px solid rgba(52,211,153,0.25)",
                        }}
                      >
                        Применить
                      </button>
                      <button
                        onClick={() => { setPhase("idle"); setSuggestions([]); }}
                        className="flex-1 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] transition-all"
                        style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}
                      >
                        Отмена
                      </button>
                    </div>
                  </motion.div>
                )}

                {phase === "applied" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 py-2.5 px-3 rounded-xl"
                    style={{
                      background: "rgba(52,211,153,0.08)",
                      border: "1px solid rgba(52,211,153,0.2)",
                    }}
                  >
                    <svg
                      className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 16 16"
                      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                    >
                      <path d="M2 8l4 4 8-8" />
                    </svg>
                    <span className="text-sm text-emerald-400 font-medium">
                      Рекомендации применены
                    </span>
                    <button
                      onClick={() => setPhase("idle")}
                      className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      Сбросить
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}