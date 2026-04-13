"use client";
/**
 * @file SettingsTabs.tsx — app/(main)/settings
 *
 * UPDATED v3:
 *   - Added "Журнал" (Audit) tab — admin only
 *   - Passes isAdmin prop to conditionally show audit tab
 *   - Adds logout button in the top bar
 */
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RolesTab }      from "./RolesTab";
import { UsersTab }      from "./UsersTab";
import { EpicsTab }      from "./EpicsTab";
import { TasksTab }      from "./TasksTab";
import { AppearanceTab } from "./AppearanceTab";
import { AuditTab }      from "./AuditTab";
import type { DbRole, UserWithMeta, EpicWithTasks } from "@/shared/types";
import { StoreHydrator } from "@/shared/store/StoreHydrator";
import { signOut } from "@/shared/lib/auth-client";

interface Props {
  initialRoles: DbRole[];
  initialUsers: UserWithMeta[];
  initialEpics: EpicWithTasks[];
  isAdmin: boolean;
  currentUserEmail?: string;
}

const BASE_TABS = [
  { key: "appearance" as const, label: "Внешний вид" },
  { key: "roles"      as const, label: "Роли"        },
  { key: "users"      as const, label: "Пользователи" },
  { key: "epics"      as const, label: "Эпики"        },
  { key: "tasks"      as const, label: "Задачи"       },
] as const;

const ADMIN_TABS = [
  ...BASE_TABS,
  { key: "audit" as const, label: "Журнал" },
] as const;

type TabKey = "appearance" | "roles" | "users" | "epics" | "tasks" | "audit";

export function SettingsTabs({
  initialRoles,
  initialUsers,
  initialEpics,
  isAdmin,
  currentUserEmail,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("appearance");
  const [loggingOut, setLoggingOut] = useState(false);

  const TABS = isAdmin ? ADMIN_TABS : BASE_TABS;

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await signOut({ fetchOptions: { onSuccess: () => router.push("/login") } });
    } finally {
      setLoggingOut(false);
    }
  }, [router]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <StoreHydrator epics={initialEpics} />

      {/* Tab bar */}
      <div
        className="px-6 py-3 flex items-center gap-1 border-b shrink-0 flex-wrap"
        style={{ borderColor: "var(--glass-border)", background: "var(--filter-bar-bg)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={
              tab === t.key
                ? {
                    background: t.key === "audit"
                      ? "rgba(239,68,68,0.12)"
                      : "var(--accent-glow)",
                    color: t.key === "audit" ? "#f87171" : "var(--accent-400)",
                    border: `1px solid ${t.key === "audit" ? "rgba(239,68,68,0.3)" : "rgba(139,92,246,0.3)"}`,
                  }
                : { color: "var(--text-secondary)" }
            }
          >
            {t.key === "audit" && (
              <span className="mr-1.5 text-xs">📋</span>
            )}
            {t.label}
          </button>
        ))}

        {/* Spacer + user info + logout */}
        <div className="ml-auto flex items-center gap-3">
          {currentUserEmail && (
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono px-2.5 py-1 rounded-full"
                style={{
                  background: isAdmin ? "rgba(139,92,246,0.14)" : "rgba(100,116,139,0.14)",
                  color:      isAdmin ? "#a78bfa" : "#94a3b8",
                  border:     `1px solid ${isAdmin ? "rgba(139,92,246,0.25)" : "rgba(100,116,139,0.25)"}`,
                }}
              >
                {isAdmin ? "👑 Администратор" : "👤 Участник"}
              </span>
              <span
                className="text-xs font-mono hidden sm:block"
                style={{ color: "var(--text-muted)" }}
              >
                {currentUserEmail}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
            style={{
              background: "var(--glass-01)",
              border:     "1px solid var(--glass-border)",
              color:      "var(--text-muted)",
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2M9 10l3-3-3-3M12 7H5" />
            </svg>
            {loggingOut ? "Выход..." : "Выйти"}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "appearance" && <AppearanceTab />}
        {tab === "roles"      && <RolesTab  initialRoles={initialRoles} />}
        {tab === "users"      && <UsersTab  initialUsers={initialUsers} roles={initialRoles} />}
        {tab === "epics"      && <EpicsTab  initialEpics={initialEpics} />}
        {tab === "tasks"      && <TasksTab  initialEpics={initialEpics} users={initialUsers} />}
        {tab === "audit"      && isAdmin && <AuditTab />}
      </div>
    </div>
  );
}