/**
 * @file Sidebar.tsx — widgets/sidebar
 *
 * Premium sidebar — background gradient now uses var(--sidebar-top)
 * so it adapts to both dark (#0c0d1e) and light (#d8d3cb) themes.
 */
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { TeamAvatars } from "@/features/team/TeamAvatars";
import { useSyncStatus } from "@/shared/store/useTaskStore";
import type { DbEpic } from "@/shared/types";
import type { UserWithMeta } from "@/shared/types";
import { motion } from "framer-motion";

interface Props {
  epics: (DbEpic & { taskCount: number; doneCount: number })[];
  users: UserWithMeta[];
}

function SyncBadge() {
  const { status, lastSyncedAt, offlineQueueSize } = useSyncStatus();
  // useSyncStatus теперь возвращает offlineQueueSize (обновлён в useTaskStore)

  // Если есть очередь офлайн-операций — показываем особый статус
  if (offlineQueueSize > 0) {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    return (
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-yellow-400 animate-pulse" />
        <span className="text-xs font-mono text-(--text-muted)">
          {isOffline ? "OFFLINE" : "SYNC"}:{" "}
          <span className="font-semibold text-yellow-400">
            {offlineQueueSize} в очереди
          </span>
        </span>
      </div>
    );
  }

  const config = {
    idle: { dot: "bg-slate-500", label: "LOCAL", text: "IDLE" },
    syncing: { dot: "bg-amber-400 animate-pulse", label: "LOCAL", text: "SYNCING" },
    synced: { dot: "bg-emerald-400", label: "LOCAL", text: "SYNCED" },
    error: { dot: "bg-red-400", label: "LOCAL", text: "ERROR" },
  } as const;

  const { dot, label, text } = config[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="text-xs font-mono text-(--text-muted)">
        {label}:{" "}
        <span
          className={`font-semibold ${status === "synced" ? "text-emerald-400" :
              status === "syncing" ? "text-amber-400" :
                status === "error" ? "text-red-400" :
                  "text-slate-500"
            }`}
        >
          {text}
        </span>
      </span>
      {lastSyncedAt && status === "synced" && (
        <span className="text-xs text-(--text-muted) font-mono ml-auto">
          {lastSyncedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

export function Sidebar({ epics, users }: Props) {
  const pathname = usePathname();

  const overallTotal = epics.reduce((s, e) => s + e.taskCount, 0);
  const overallDone = epics.reduce((s, e) => s + e.doneCount, 0);
  const overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-20 overflow-hidden"
      style={{ width: "var(--sidebar-w)" }}
    >
      {/* Deep background — was from-[#0c0d1e] (Tailwind arbitrary), now CSS var */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, var(--sidebar-top), var(--bg-base))" }}
      />
      <div className="absolute inset-y-0 right-0 w-px bg-(--glass-border)" />

      {/* Ambient glow top-left */}
      <div className="absolute top-0 left-0 w-48 h-48 rounded-full bg-[var(--accent-500)] opacity-[0.05] blur-3xl pointer-events-none" />

      <div className="relative flex flex-col h-full">
        {/* ── Logo ─────────────────────────────────────────────────────── */}
        <div className="px-5 flex items-center border-b border-[var(--glass-border)]" style={{ height: "var(--header-h)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-500)] flex items-center justify-center shadow-[0_0_12px_var(--accent-glow)]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1.5" fill="white" fillOpacity="0.9" />
                <rect x="8" y="1" width="5" height="5" rx="1.5" fill="white" fillOpacity="0.5" />
                <rect x="1" y="8" width="5" height="5" rx="1.5" fill="white" fillOpacity="0.5" />
                <rect x="8" y="8" width="5" height="5" rx="1.5" fill="white" fillOpacity="0.9" />
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight text-[var(--text-primary)]">
              Task<span style={{ color: "var(--accent-400)" }}>Flow</span>
            </span>
          </div>
          <div className="ml-auto">
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--glass-02)] text-(--text-muted) border border-[var(--glass-border)]">
              v2
            </span>
          </div>
        </div>

        {/* ── Primary Nav ───────────────────────────────────────────────── */}
        <nav className="px-3 pt-4 space-y-0.5">
          {([
            {
              href: "/dashboard",
              label: "Обзор",
              icon: DashboardIcon,
              badge: null,
            },
            {
              href: "/board",
              label: "Доска",
              icon: BoardIcon,
              badge: null,
            },
            {
              href: "/settings",
              label: "Настройки",
              icon: SettingsIcon,
              badge: null,
            },
          ] as const).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "nav-item group",
                  active
                    ? "bg-[var(--accent-glow)] text-[var(--accent-400)] border border-[rgba(139,92,246,0.25)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon active={active} />
                {label}
                {href === "/settings" && (
                  <motion.span
                    className="ml-auto opacity-0 group-hover:opacity-60 text-[10px] font-mono"
                    style={{ color: "var(--text-muted)" }}
                    transition={{ duration: 0.15 }}
                  >
                    ⚙
                  </motion.span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Overall progress ─────────────────────────────────────────── */}
        <div className="mx-3 mt-4 mb-1 px-3 py-2.5 rounded-xl bg-[var(--glass-01)] border border-[var(--glass-border)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-(--text-muted)">Общий прогресс</span>
            <span className="text-xs font-mono font-semibold" style={{ color: "var(--accent-400)" }}>
              {overallPct}%
            </span>
          </div>
          <div className="h-1 bg-[var(--glass-02)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${overallPct}%`,
                background: "linear-gradient(90deg, var(--accent-500), var(--accent-400))",
                boxShadow: "0 0 8px var(--accent-glow)",
              }}
            />
          </div>
          <p className="mt-1 text-xs text-(--text-muted) font-mono">
            {overallDone}/{overallTotal} задач
          </p>
        </div>

        {/* ── Epics list ────────────────────────────────────────────────── */}
        <div className="px-3 pt-4 flex-1 overflow-y-auto min-h-0">
          <p className="px-3 pb-2 text-xs font-semibold text-(--text-muted) uppercase tracking-widest">
            Эпики
          </p>
          <div className="space-y-0.5">
            {epics.map((epic) => {
              const pct = epic.taskCount > 0 ? Math.round((epic.doneCount / epic.taskCount) * 100) : 0;
              const isActive = pathname === `/epics/${epic.id}`;
              return (
                <Link
                  key={epic.id}
                  href={`/epics/${epic.id}`}
                  className={cn(
                    "group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                    isActive
                      ? "bg-[var(--glass-02)] text-[var(--text-primary)] border border-[var(--glass-border-active)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-01)]"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 transition-all duration-150"
                    style={{
                      backgroundColor: epic.color,
                      boxShadow: isActive ? `0 0 6px ${epic.color}80` : "none",
                    }}
                  />
                  <span className="flex-1 truncate text-xs leading-snug">{epic.title}</span>

                  <div className="shrink-0 relative w-5 h-5">
                    <svg viewBox="0 0 20 20" className="w-5 h-5 -rotate-90">
                      <circle cx="10" cy="10" r="7" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                      <circle
                        cx="10" cy="10" r="7" fill="none"
                        stroke={epic.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 7}`}
                        strokeDashoffset={`${2 * Math.PI * 7 * (1 - pct / 100)}`}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-semibold rotate-90"
                      style={{ color: epic.color }}
                    >
                      {pct}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Team section ─────────────────────────────────────────────── */}
        <div className="mx-3 mb-3 px-3 py-3 rounded-xl bg-[var(--glass-01)] border border-[var(--glass-border)]">
          <p className="text-xs font-semibold text-(--text-muted) uppercase tracking-widest mb-2">
            Команда
          </p>
          <TeamAvatars users={users} maxVisible={6} />
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-[var(--glass-border)]">
          <SyncBadge />
        </div>
      </div>
    </aside>
  );
}

// ── Icon components ───────────────────────────────────────────────────────────

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")}
      viewBox="0 0 16 16" fill="currentColor"
    >
      <rect x="1" y="1" width="6" height="6" rx="1.5" fillOpacity={active ? 1 : 0.7} />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fillOpacity={active ? 0.7 : 0.4} />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fillOpacity={active ? 0.7 : 0.4} />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fillOpacity={active ? 1 : 0.7} />
    </svg>
  );
}

function BoardIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")}
      viewBox="0 0 16 16" fill="currentColor"
    >
      <rect x="1" y="1" width="4" height="14" rx="1.5" fillOpacity={active ? 1 : 0.6} />
      <rect x="6" y="1" width="4" height="9" rx="1.5" fillOpacity={active ? 0.8 : 0.4} />
      <rect x="11" y="1" width="4" height="11" rx="1.5" fillOpacity={active ? 0.6 : 0.3} />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")}
      viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={active ? "1.8" : "1.5"} strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.92.92M11.68 11.68l.92.92M3.4 12.6l.92-.92M11.68 4.32l.92-.92" />
    </svg>
  );
}