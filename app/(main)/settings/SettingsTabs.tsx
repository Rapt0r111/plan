"use client";
import { useState } from "react";
import { RolesTab } from "./RolesTab";
import { UsersTab } from "./UsersTab";
import { EpicsTab } from "./EpicsTab";
import { TasksTab } from "./TasksTab";
import { AppearanceTab } from "./AppearanceTab"; // ← добавить
import type { DbRole, UserWithMeta, EpicWithTasks } from "@/shared/types";

interface Props {
  initialRoles: DbRole[];
  initialUsers: UserWithMeta[];
  initialEpics: EpicWithTasks[];
}

const TABS = [
  { key: "appearance" as const, label: "Внешний вид" }, // ← добавить первым
  { key: "roles"  as const, label: "Роли"        },
  { key: "users"  as const, label: "Пользователи" },
  { key: "epics"  as const, label: "Эпики"        },
  { key: "tasks"  as const, label: "Задачи"       },
];

type TabKey = (typeof TABS)[number]["key"];

export function SettingsTabs({ initialRoles, initialUsers, initialEpics }: Props) {
  const [tab, setTab] = useState<TabKey>("appearance"); // ← дефолт на внешний вид

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div
        className="px-6 py-3 flex gap-1 border-b shrink-0"
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
        {tab === "appearance" && <AppearanceTab />} {/* ← добавить */}
        {tab === "roles"      && <RolesTab initialRoles={initialRoles} />}
        {tab === "users"      && <UsersTab initialUsers={initialUsers} roles={initialRoles} />}
        {tab === "epics"      && <EpicsTab initialEpics={initialEpics} />}
        {tab === "tasks"      && <TasksTab initialEpics={initialEpics} users={initialUsers} />}
      </div>
    </div>
  );
}