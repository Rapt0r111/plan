/**
 * @file Sidebar.tsx — widgets/sidebar
 * v7 — Оптимизированы плавные CSS-переходы и добавлена эстетичная парящая кнопка-ручка (Grip handle).
 */
"use client";
import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { TeamAvatars } from "@/features/team/TeamAvatars";
import { useSyncStatus } from "@/shared/store/useTaskStore";
import { UserMenu } from "@/shared/ui/UserMenu";
import { NotificationCenter } from "@/features/notifications/NotificationCenter";
import type { DbEpic } from "@/shared/types";
import type { UserWithMeta } from "@/shared/types";
import type { Session } from "@/shared/lib/auth";

// ── Context для управления состоянием Sidebar ──
const SidebarContext = createContext<{
  isCollapsed: boolean;
  mounted: boolean;
  toggle: () => void;
}>({ isCollapsed: false, mounted: false, toggle: () => {} });

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(() => (
    typeof window !== "undefined" && localStorage.getItem("sidebar-collapsed") === "true"
  ));
  const mounted = true;

  const toggle = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, mounted, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);

// ── Обертка основного контента для синхронной анимации сжатия ──
export function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, mounted } = useSidebar();

  const transitionStyle = mounted
    ? "margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1)"
    : "none";

  const bgTransitionStyle = mounted
    ? "left 300ms cubic-bezier(0.4, 0, 0.2, 1)"
    : "none";

  return (
    <main
      className="flex-1 flex flex-col overflow-hidden relative"
      style={{
        marginLeft: isCollapsed ? "64px" : "var(--sidebar-w)",
        transition: transitionStyle
      }}
    >
      <div
        className="pointer-events-none fixed top-0 right-0 h-64 bg-linear-to-b from-[rgba(139,92,246,0.04)] to-transparent z-0"
        style={{
          left: isCollapsed ? "64px" : "var(--sidebar-w)",
          transition: bgTransitionStyle
        }}
      />
      <div className="flex-1 overflow-y-auto relative z-10">
        {children}
      </div>
    </main>
  );
}

interface Props {
  epics: (DbEpic & { taskCount: number; doneCount: number })[];
  users: UserWithMeta[];
  session: Session | null;
  isVariableRestricted?: boolean;
}

function SyncBadge({ isCollapsed }: { isCollapsed: boolean }) {
  const { status, lastSyncedAt, offlineQueueSize } = useSyncStatus();

  if (offlineQueueSize > 0) {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    return (
      <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2")}>
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 bg-yellow-400 animate-pulse"
          title={isCollapsed ? `SYNC: ${offlineQueueSize} в очереди` : undefined}
        />
        {!isCollapsed && (
          <span className="text-xs font-mono text-(--text-muted)">
            {offline ? "OFFLINE" : "SYNC"}:{" "}
            <span className="font-semibold text-yellow-400">{offlineQueueSize} в очереди</span>
          </span>
        )}
      </div>
    );
  }

  const config = {
    idle:    { dot: "bg-slate-500",              label: "LOCAL", text: "IDLE"    },
    syncing: { dot: "bg-amber-400 animate-pulse", label: "LOCAL", text: "SYNCING" },
    synced:  { dot: "bg-emerald-400",             label: "LOCAL", text: "SYNCED"  },
    error:   { dot: "bg-red-400",                 label: "LOCAL", text: "ERROR"   },
  } as const;

  const { dot, label, text } = config[status];

  return (
    <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2")}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} title={isCollapsed ? `${label}: ${text}` : undefined} />
      {!isCollapsed && (
        <>
          <span className="text-xs font-mono text-(--text-muted)">
            {label}:{" "}
            <span className={cn("font-semibold",
              status === "synced" ? "text-emerald-400" :
              status === "syncing" ? "text-amber-400" :
              status === "error" ? "text-red-400" : "text-slate-500"
            )}>
              {text}
            </span>
          </span>
          {lastSyncedAt && status === "synced" && (
            <span className="text-xs text-(--text-muted) font-mono ml-auto">
              {lastSyncedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function Sidebar({ epics, users, session, isVariableRestricted = false }: Props) {
  const pathname = usePathname();
  const { isCollapsed, mounted, toggle } = useSidebar();

  const sessionProfileId = (session?.user as { profileId?: number | null } | undefined)?.profileId;
  const isLimitedAccount = !!session?.user && session.user.role !== "admin" && typeof sessionProfileId !== "number";
  const overallTotal = epics.reduce((s, e) => s + e.taskCount, 0);
  const overallDone  = epics.reduce((s, e) => s + e.doneCount, 0);
  const overallPct   = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;

  const sidebarTransitionStyle = mounted
    ? "width 300ms cubic-bezier(0.4, 0, 0.2, 1)"
    : "none";

  return (
    <aside
      className={cn(
        "group/sidebar fixed left-0 top-0 h-screen flex flex-col z-20 overflow-visible border-r border-[var(--glass-border)]"
      )}
      style={{
        width: isCollapsed ? "64px" : "var(--sidebar-w)",
        transition: sidebarTransitionStyle
      }}
    >
      <div className="absolute inset-0 z-0" style={{ background: "linear-gradient(to bottom, var(--sidebar-top), var(--bg-base))" }} />
      <div className="absolute top-0 left-0 w-48 h-48 rounded-full bg-[var(--accent-500)] opacity-[0.05] blur-3xl pointer-events-none" />

      {/* ── Парящая Grip-кнопка переключения на границе панели ── */}
      {mounted && (
        <button
          onClick={toggle}
          className={cn(
            "absolute top-6 right-0 translate-x-1/2 z-30 cursor-pointer",
            "w-5 h-5 rounded-full border border-[var(--glass-border)] bg-[var(--sidebar-top)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            "flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)]",
            "pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:pointer-events-auto",
            "transition-all duration-200 hover:scale-110 active:scale-95",
            "focus-visible:pointer-events-auto"
          )}
          title={isCollapsed ? "Развернуть панель" : "Свернуть панель"}
        >
          <ChevronIcon isCollapsed={isCollapsed} />
        </button>
      )}

      <div className="relative flex flex-col h-full z-10">
        {/* ── Logo ── */}
        <div
          className={cn(
            "flex items-center border-b border-[var(--glass-border)] shrink-0 px-4 transition-all duration-200 justify-between"
          )}
          style={{ height: "var(--header-h)" }}
        >
          <div className={cn("flex items-center gap-2.5", isCollapsed ? "mx-auto" : "")}>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-500)] flex items-center justify-center shadow-[0_0_12px_var(--accent-glow)] shrink-0">
              <LogoSvg />
            </div>
            <span className={cn(
              "font-semibold text-sm tracking-tight text-[var(--text-primary)] transition-all duration-300 overflow-hidden",
              isCollapsed ? "w-0 opacity-0 pointer-events-none select-none hidden" : "w-auto opacity-100"
            )}>
              Task<span style={{ color: "var(--accent-400)" }}>Flow</span>
            </span>
          </div>

          {!isCollapsed && (
            <div className="flex items-center gap-1.5 shrink-0 animate-in fade-in duration-300">
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--glass-02)] text-(--text-muted) border border-[var(--glass-border)]">v2</span>
            </div>
          )}
        </div>

        {/* -- Primary Nav -- */}
        <nav className={cn("pt-4 space-y-3 transition-all duration-300", isCollapsed ? "px-1.5" : "px-3")}>
          {([
            {
              title: "Работа",
              items: isLimitedAccount ? [] : [
                { href: "/dashboard", label: "Обзор", icon: DashboardIcon },
                { href: "/management", label: "Контроль", icon: ManagementIcon },
                { href: "/board", label: "Доска", icon: BoardIcon },
                { href: "/operative", label: "Оперативные", icon: OperativeIcon },
                ...(!isVariableRestricted ? [{ href: "/personal-plan", label: "Личный план", icon: PersonalPlanIcon }] : []),
              ],
            },
            {
              title: "Аккаунт",
              items: [
                ...(!isLimitedAccount ? [{ href: "/settings", label: "Настройки", icon: SettingsIcon }] : []),
              ],
            },
          ] as const).filter((group) => group.items.length > 0).map((group) => (
            <div key={group.title} className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {group.title}
                </p>
              )}
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link key={href} href={href}
                    className={cn(
                      "nav-item group flex items-center transition-all duration-300 rounded-xl",
                      active
                        ? "bg-[var(--accent-glow)] text-[var(--accent-400)] border border-[rgba(139,92,246,0.25)] font-medium"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:bg-[var(--glass-01)]",
                      isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                    )}
                    title={isCollapsed ? label : undefined}
                  >
                    <Icon active={active} />
                    <span className={cn(
                      "truncate text-xs transition-all duration-300",
                      isCollapsed ? "w-0 opacity-0 pointer-events-none select-none hidden" : "opacity-100"
                    )}>
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>


        {/* ── Epics list ── */}
        <div className={cn("pt-4 flex-1 overflow-y-auto min-h-0 transition-all duration-300", isCollapsed ? "px-1.5" : "px-3")}>
          <p className={cn(
            "pb-2 text-xs font-semibold text-(--text-muted) uppercase tracking-widest transition-all duration-300 text-center",
            isCollapsed ? "opacity-0 h-0 overflow-hidden pb-0" : "px-3 opacity-100"
          )}>
            Эпики
          </p>
          <div className="space-y-1">
            {epics.map((epic) => {
              const pct = epic.taskCount > 0 ? Math.round((epic.doneCount / epic.taskCount) * 100) : 0;
              const isActive = pathname === `/epics/${epic.id}`;
              return (
                <Link key={epic.id} href={`/epics/${epic.id}`}
                  className={cn(
                    "group flex items-center transition-all duration-300 rounded-xl",
                    isActive
                      ? "bg-[var(--glass-02)] text-[var(--text-primary)] border border-[var(--glass-border-active)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-01)] border border-transparent",
                    isCollapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5"
                  )}
                  title={isCollapsed ? epic.title : undefined}
                >
                  <span
                    className={cn(
                      "rounded-full shrink-0 transition-all duration-300",
                      isCollapsed ? "w-0 h-0 opacity-0 m-0" : "w-2 h-2"
                    )}
                    style={{
                      backgroundColor: epic.color,
                      boxShadow: (isActive && !isCollapsed) ? `0 0 6px ${epic.color}80` : "none"
                    }}
                  />
                  <span className={cn(
                    "flex-1 truncate text-xs leading-snug transition-all duration-300",
                    isCollapsed ? "w-0 opacity-0 pointer-events-none hidden" : "opacity-100"
                  )}>
                    {epic.title}
                  </span>
                  <div className="shrink-0 relative w-5 h-5 flex items-center justify-center">
                    <svg viewBox="0 0 20 20" className="w-5 h-5 -rotate-90">
                      <circle cx="10" cy="10" r="7" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                      <circle cx="10" cy="10" r="7" fill="none" stroke={epic.color} strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 7}`} strokeDashoffset={`${2 * Math.PI * 7 * (1 - pct / 100)}`} className="transition-all duration-700" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-semibold" style={{ color: epic.color }}>{pct}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>



        {/* -- User menu / auth CTA -- */}
        {session?.user ? (
          <div className={cn("pb-2 transition-all duration-300 shrink-0", isCollapsed ? "px-1.5" : "px-3")} title={isCollapsed ? session.user.name : undefined}>
            <div className={cn("mb-2 transition-all duration-300", isCollapsed ? "max-h-0 opacity-0 overflow-hidden mb-0" : "max-h-12 opacity-100")}>
              <NotificationCenter />
            </div>
            <div className={cn("overflow-visible transition-all duration-300", isCollapsed ? "w-10 h-10 mx-auto rounded-xl bg-[var(--glass-01)] border border-[var(--glass-border)] flex items-center justify-center" : "w-full")}>
              <UserMenu
                userId={session.user.id}
                name={session.user.name}
                login={(session.user as { login?: string | null }).login}
                role={session.user.role ?? "member"}
              />
            </div>
          </div>
        ) : (
          <div className={cn("pb-2 transition-all duration-300 shrink-0", isCollapsed ? "px-1.5" : "px-3")}>
            {isCollapsed ? (
              <Link
                href="/login"
                className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center border text-[var(--accent-400)]"
                style={{ background: "var(--glass-01)", borderColor: "rgba(139,92,246,0.3)" }}
                title="Войти"
              >
                <LoginIcon />
              </Link>
            ) : (
              <div className="rounded-2xl p-3 space-y-2" style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Войдите в аккаунт</p>
                <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>Доступ к профилю и задачам после авторизации.</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link href="/login" className="px-3 py-2 rounded-xl text-xs font-semibold text-center" style={{ background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.3)" }}>
                    Войти
                  </Link>
                  <Link href="/register" className="px-3 py-2 rounded-xl text-xs font-semibold text-center" style={{ background: "var(--glass-02)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}>
                    Регистрация
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Footer: sync status ── */}
        <div className={cn("border-t border-[var(--glass-border)] transition-all duration-300 shrink-0", isCollapsed ? "px-2 py-3" : "px-4 py-3")}>
          <SyncBadge isCollapsed={isCollapsed} />
        </div>
      </div>
    </aside>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function LogoSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1.5" fill="white" fillOpacity="0.9" />
      <rect x="8" y="1" width="5" height="5" rx="1.5" fill="white" fillOpacity="0.5" />
      <rect x="1" y="8" width="5" height="5" rx="1.5" fill="white" fillOpacity="0.5" />
      <rect x="8" y="8" width="5" height="5" rx="1.5" fill="white" fillOpacity="0.9" />
    </svg>
  );
}

function ChevronIcon({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <svg
      className={cn("w-3 h-3 transition-transform duration-300", isCollapsed ? "" : "rotate-180")}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 12l4-4-4-4" />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")} viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fillOpacity={active ? 1 : 0.7} />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fillOpacity={active ? 0.7 : 0.4} />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fillOpacity={active ? 0.7 : 0.4} />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fillOpacity={active ? 1 : 0.7} />
    </svg>
  );
}

function BoardIcon({ active }: { active: boolean }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")} viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="4" height="14" rx="1.5" fillOpacity={active ? 1 : 0.6} />
      <rect x="6" y="1" width="4" height="9"  rx="1.5" fillOpacity={active ? 0.8 : 0.4} />
      <rect x="11" y="1" width="4" height="11" rx="1.5" fillOpacity={active ? 0.6 : 0.3} />
    </svg>
  );
}

function ManagementIcon({ active }: { active: boolean }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13.5h12" />
      <path d="M3.5 11V7.5" />
      <path d="M8 11V3" />
      <path d="M12.5 11V5.5" />
      <path d="M3 5.5l3 1.5 3-3 4 1.5" />
    </svg>
  );
}

function OperativeIcon({ active }: { active: boolean }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="4.5" r="2.2" />
      <path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" />
      <circle cx="12.5" cy="11.5" r="2.8" fill={active ? "var(--accent-400)" : "transparent"} stroke="currentColor" strokeWidth="1.2" />
      <path d="M11.2 11.5l1 1 2-2" strokeWidth="1.2" />
    </svg>
  );
}

function PersonalPlanIcon({ active }: { active: boolean }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <path d="M5 1.5v2M11 1.5v2M2.5 6h11" />
      <path d="M5 9h2.2M5 11.5h4.5" />
      <circle cx="11.5" cy="9.5" r="1.4" fill={active ? "var(--accent-400)" : "transparent"} stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5" r="3" />
      <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5V2.5A1.5 1.5 0 0 1 7.5 1h5A1.5 1.5 0 0 1 14 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 6 13.5v-1" />
      <path d="M1.5 8h8M7.5 5.8 9.7 8l-2.2 2.2" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"} strokeLinecap="round">
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.92.92M11.68 11.68l.92.92M3.4 12.6l.92-.92M11.68 4.32l.92-.92" />
    </svg>
  );
}
