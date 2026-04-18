"use client";
import { useState } from "react";
import { RolesTab } from "./RolesTab";
import { UsersTab } from "./UsersTab";
import { EpicsTab } from "./EpicsTab";
import { TasksTab } from "./TasksTab";
import { AppearanceTab } from "./AppearanceTab";
import { AuditTab } from "./AuditTab";
import { SecurityTab } from "./SecurityTab";
import type { DbRole, UserWithMeta, EpicWithTasks } from "@/shared/types";
import { StoreHydrator } from "@/shared/store/StoreHydrator";

interface Props {
  initialRoles: DbRole[];
  initialUsers: UserWithMeta[];
  initialEpics: EpicWithTasks[];
  isAdmin: boolean;
}

const TABS_BASE = [
  { key: "appearance" as const, label: "Внешний вид" },
  { key: "security"   as const, label: "Безопасность" },
  { key: "roles"      as const, label: "Роли"          },
  { key: "users"      as const, label: "Пользователи"  },
  { key: "epics"      as const, label: "Эпики"          },
  { key: "tasks"      as const, label: "Задачи"         },
] as const;

const ADMIN_TABS = [
  ...TABS_BASE,
  { key: "audit" as const, label: "Аудит" },
] as const;

type TabKey = (typeof ADMIN_TABS)[number]["key"];

export function SettingsTabs({ initialRoles, initialUsers, initialEpics, isAdmin }: Props) {
  const TABS = isAdmin ? ADMIN_TABS : TABS_BASE;
  const [tab, setTab] = useState<TabKey>("appearance");

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <StoreHydrator epics={initialEpics} />
      <div
        className="px-6 py-3 flex gap-1 border-b shrink-0 overflow-x-auto"
        style={{ borderColor: "var(--glass-border)", background: "var(--filter-bar-bg)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as TabKey)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0"
            style={
              tab === t.key
                ? {
                    background: "var(--accent-glow)",
                    color: "var(--accent-400)",
                    border: "1px solid rgba(139,92,246,0.3)",
                  }
                : { color: "var(--text-secondary)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "appearance" && <AppearanceTab />}
        {tab === "security"   && <SecurityTab />}
        {tab === "roles"      && <RolesTab initialRoles={initialRoles} />}
        {tab === "users"      && <UsersTab initialUsers={initialUsers} roles={initialRoles} />}
        {tab === "epics"      && <EpicsTab initialEpics={initialEpics} />}
        {tab === "tasks"      && <TasksTab initialEpics={initialEpics} users={initialUsers} />}
        {tab === "audit"      && isAdmin && <AuditTab />}
      </div>
    </div>
  );
}