/**
 * @file Sidebar.tsx ? widgets/sidebar
 * Polished animated sidebar without sync/notification islands.
 */
"use client";

import { createContext, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { UserMenu } from "@/shared/ui/UserMenu";
import type { DbEpic } from "@/shared/types";
import type { UserWithMeta } from "@/shared/types";
import type { Session } from "@/shared/lib/auth";

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

export function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, mounted } = useSidebar();

  const transitionStyle = mounted
    ? "margin-left 320ms cubic-bezier(0.16, 1, 0.3, 1)"
    : "none";

  const bgTransitionStyle = mounted
    ? "left 320ms cubic-bezier(0.16, 1, 0.3, 1)"
    : "none";

  return (
    <main
      className="relative flex flex-1 flex-col overflow-hidden"
      style={{
        marginLeft: isCollapsed ? "72px" : "var(--sidebar-w)",
        transition: transitionStyle,
      }}
    >
      <div
        className="pointer-events-none fixed top-0 right-0 z-0 h-72 bg-linear-to-b from-[rgba(20,184,166,0.06)] to-transparent"
        style={{
          left: isCollapsed ? "72px" : "var(--sidebar-w)",
          transition: bgTransitionStyle,
        }}
      />
      <div className="relative z-10 flex-1 overflow-y-auto">
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
  isPasswordChangeRequired?: boolean;
}

type NavIcon = (props: { active: boolean }) => React.ReactNode;
type NavItem = { href: string; label: string; icon: NavIcon };
type NavGroup = { id: string; title: string; caption: string; items: NavItem[] };

export function Sidebar({ epics, users: _users, session, isVariableRestricted = false, isPasswordChangeRequired = false }: Props) {
  const pathname = usePathname();
  const { isCollapsed, mounted, toggle } = useSidebar();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ work: true, account: true, epics: true });
  void _users;

  const sessionProfileId = (session?.user as { profileId?: number | null } | undefined)?.profileId;
  const isLimitedAccount = !!session?.user && session.user.role !== "admin" && typeof sessionProfileId !== "number";
  const isRestrictedToPasswordChange = isPasswordChangeRequired;

  const groups = useMemo<NavGroup[]>(() => ([
    {
      id: "work",
      title: "Работа",
      caption: "основные разделы",
      items: isRestrictedToPasswordChange || isLimitedAccount ? [] : [
        { href: "/today", label: "Сегодня", icon: TodayIcon },
        { href: "/dashboard", label: "Доска", icon: DashboardIcon },
        { href: "/management", label: "Контроль", icon: ManagementIcon },
        { href: "/board", label: "Доска", icon: BoardIcon },
        { href: "/operative", label: "Оперативные", icon: OperativeIcon },
        ...(!isVariableRestricted ? [{ href: "/personal-plan", label: "Недельный план", icon: PersonalPlanIcon }] : []),
      ],
    },
    {
      id: "account",
      title: "Аккаунт",
      caption: "профиль и настройки",
      items: [
        ...(isRestrictedToPasswordChange
          ? [{ href: "/profile", label: "Сменить пароль", icon: SettingsIcon }]
          : !isLimitedAccount ? [{ href: "/settings", label: "Настройки", icon: SettingsIcon }] : []),
      ],
    },
  ]).filter((group) => group.items.length > 0), [isLimitedAccount, isRestrictedToPasswordChange, isVariableRestricted]);

  const sidebarTransitionStyle = mounted
    ? "width 320ms cubic-bezier(0.16, 1, 0.3, 1)"
    : "none";

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <aside
      className="group/sidebar fixed left-0 top-0 z-20 flex h-screen flex-col overflow-visible border-r border-[var(--glass-border)]"
      style={{
        width: isCollapsed ? "72px" : "var(--sidebar-w)",
        transition: sidebarTransitionStyle,
      }}
    >
      <div className="absolute inset-0 z-0" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--sidebar-top) 92%, #14b8a6 8%) 0%, var(--bg-base) 100%)" }} />
      <div className="pointer-events-none absolute -left-16 top-8 h-48 w-48 rounded-full bg-[var(--accent-500)] opacity-[0.08] blur-3xl" />
      <div className="pointer-events-none absolute bottom-16 right-0 h-36 w-36 rounded-full bg-teal-400 opacity-[0.06] blur-3xl" />

      {mounted && (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "absolute top-6 right-0 z-30 flex h-7 w-7 translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-[var(--glass-border)]",
            "bg-[var(--bg-elevated)] text-[var(--text-secondary)] shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl",
            "opacity-80 transition-all duration-200 hover:scale-105 hover:text-[var(--text-primary)] hover:opacity-100 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)]"
          )}
          aria-label={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
          title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          <ChevronIcon isCollapsed={isCollapsed} />
        </button>
      )}

      <div className="relative z-10 flex h-full flex-col">
        <div
          className={cn(
            "flex shrink-0 items-center justify-between border-b border-[var(--glass-border)] px-4 transition-all duration-300",
            isCollapsed && "justify-center px-2"
          )}
          style={{ height: "var(--header-h)" }}
        >
          <div className={cn("flex items-center gap-2.5", isCollapsed && "justify-center")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 via-[var(--accent-400)] to-[var(--accent-500)] shadow-[0_0_24px_var(--accent-glow)] ring-1 ring-white/10">
              <LogoSvg />
            </div>
            <span className={cn(
              "overflow-hidden whitespace-nowrap text-sm font-semibold tracking-tight text-[var(--text-primary)] transition-all duration-300",
              isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}>
              Task<span className="text-teal-300">Flow</span>
            </span>
          </div>
          {!isCollapsed && (
            <span className="rounded-full border border-[var(--glass-border)] bg-[var(--glass-01)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">
              menu
            </span>
          )}
        </div>

        <nav className={cn("shrink-0 space-y-2 pt-4 transition-all duration-300", isCollapsed ? "px-2" : "px-3")} aria-label="Основная навигация">
          {groups.map((group) => (
            <SidebarSection
              key={group.id}
              group={group}
              pathname={pathname}
              isCollapsed={isCollapsed}
              open={openGroups[group.id] ?? true}
              onToggle={() => toggleGroup(group.id)}
            />
          ))}
        </nav>

        <div className={cn("min-h-0 flex-1 overflow-y-auto pt-3 transition-all duration-300", isCollapsed ? "px-2" : "px-3")}>
          {isRestrictedToPasswordChange && !isCollapsed && (
            <div className="mb-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs leading-relaxed text-amber-200">
              Сначала смените пароль. Остальные разделы временно недоступны.
            </div>
          )}

          {!isRestrictedToPasswordChange && epics.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup("epics")}
                  className="group flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] transition-colors hover:bg-[var(--glass-01)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)]"
                  aria-expanded={openGroups.epics ?? true}
                >
                  <span className="flex-1">Эпики</span>
                  <span className="rounded-full bg-[var(--glass-01)] px-1.5 py-0.5 text-[9px] font-mono">{epics.length}</span>
                  <ChevronDownIcon open={openGroups.epics ?? true} />
                </button>
              )}
              <AnimatePresence initial={false}>
                {(isCollapsed || (openGroups.epics ?? true)) && (
                  <motion.div
                    initial={isCollapsed ? false : { height: 0, opacity: 0 }}
                    animate={isCollapsed ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                    exit={isCollapsed ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 pb-2">
                      {epics.map((epic) => {
                        const pct = epic.taskCount > 0 ? Math.round((epic.doneCount / epic.taskCount) * 100) : 0;
                        const isActive = pathname === `/epics/${epic.id}`;
                        return (
                          <Link
                            key={epic.id}
                            href={`/epics/${epic.id}`}
                            className={cn(
                              "group flex cursor-pointer items-center rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)]",
                              isActive
                                ? "border-[var(--glass-border-active)] bg-[var(--glass-02)] text-[var(--text-primary)] shadow-[0_10px_28px_rgba(0,0,0,0.16)]"
                                : "border-transparent text-[var(--text-secondary)] hover:border-[var(--glass-border)] hover:bg-[var(--glass-01)] hover:text-[var(--text-primary)]",
                              isCollapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5"
                            )}
                            title={isCollapsed ? epic.title : undefined}
                          >
                            <span
                              className={cn("shrink-0 rounded-full transition-all duration-300", isCollapsed ? "h-2.5 w-2.5" : "h-2 w-2")}
                              style={{
                                backgroundColor: epic.color,
                                boxShadow: isActive ? `0 0 12px ${epic.color}80` : "none",
                              }}
                            />
                            {!isCollapsed && (
                              <>
                                <span className="flex-1 truncate text-xs leading-snug">{epic.title}</span>
                                <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                                  <svg viewBox="0 0 20 20" className="h-6 w-6 -rotate-90">
                                    <circle cx="10" cy="10" r="7" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                                    <circle
                                      cx="10"
                                      cy="10"
                                      r="7"
                                      fill="none"
                                      stroke={epic.color}
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeDasharray={`${2 * Math.PI * 7}`}
                                      strokeDashoffset={`${2 * Math.PI * 7 * (1 - pct / 100)}`}
                                      className="transition-all duration-700 motion-reduce:transition-none"
                                    />
                                  </svg>
                                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-semibold" style={{ color: epic.color }}>{pct}</span>
                                </div>
                              </>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className={cn("shrink-0 border-t border-[var(--glass-border)] pb-3 pt-3 transition-all duration-300", isCollapsed ? "px-2" : "px-3")}>
          {session?.user ? (
            <div title={isCollapsed ? session.user.name : undefined}>
              <UserMenu
                userId={session.user.id}
                name={session.user.name}
                login={(session.user as { login?: string | null }).login}
                role={session.user.role ?? "member"}
                compact={isCollapsed}
              />
            </div>
          ) : isCollapsed ? (
            <Link
              href="/login"
              className="mx-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-[rgba(20,184,166,0.28)] bg-[var(--glass-01)] text-[var(--accent-400)] transition-all hover:bg-[var(--glass-02)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)]"
              title="Войти"
            >
              <LoginIcon />
            </Link>
          ) : (
            <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-01)] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
              <p className="text-xs font-semibold text-[var(--text-primary)]">Войдите в аккаунт</p>
              <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">Доступ к профилю и задачам после авторизации.</p>
              <div className="grid grid-cols-2 gap-2 pt-3">
                <Link href="/login" className="cursor-pointer rounded-xl border border-[rgba(20,184,166,0.28)] bg-[var(--accent-glow)] px-3 py-2 text-center text-xs font-semibold text-[var(--accent-400)] transition-colors hover:bg-[var(--glass-02)]">
                  Войти
                </Link>
                <Link href="/register" className="cursor-pointer rounded-xl border border-[var(--glass-border)] bg-[var(--glass-02)] px-3 py-2 text-center text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                  Регистрация
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function SidebarSection({ group, pathname, isCollapsed, open, onToggle }: {
  group: NavGroup;
  pathname: string;
  isCollapsed: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="space-y-1">
      {!isCollapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="group flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--glass-01)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)]"
          aria-expanded={open}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]">{group.title}</span>
            <span className="block truncate text-[9px] text-[var(--text-muted)] opacity-70">{group.caption}</span>
          </span>
          <ChevronDownIcon open={open} />
        </button>
      )}
      <AnimatePresence initial={false}>
        {(isCollapsed || open) && (
          <motion.div
            initial={isCollapsed ? false : { height: 0, opacity: 0 }}
            animate={isCollapsed ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={isCollapsed ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-1">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "nav-item group relative flex cursor-pointer items-center rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                      active
                        ? "border-[rgba(20,184,166,0.32)] bg-[var(--accent-glow)] text-[var(--accent-400)] shadow-[0_10px_28px_rgba(20,184,166,0.12)]"
                        : "border-transparent text-[var(--text-secondary)] hover:border-[var(--glass-border)] hover:bg-[var(--glass-01)] hover:text-[var(--text-primary)]",
                      isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"
                    )}
                    title={isCollapsed ? label : undefined}
                  >
                    {active && !isCollapsed && <span className="absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--accent-400)]" />}
                    <Icon active={active} />
                    {!isCollapsed && <span className="truncate text-xs">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn("h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-200", open && "rotate-180")}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
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

function TodayIcon({ active }: { active: boolean }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", active ? "text-[var(--accent-400)]" : "text-current")} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? "1.8" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <path d="M5 1.5v2M11 1.5v2M2.5 6h11" />
      <path d="M5 9.2l1.6 1.6L11 7.5" />
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
