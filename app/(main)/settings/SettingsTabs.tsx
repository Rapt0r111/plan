"use client";
import { useState } from "react";
import { RolesTab } from "./RolesTab";
import { UsersTab } from "./UsersTab";
import type { DbRole, UserWithMeta } from "@/shared/types";

interface Props {
  initialRoles: DbRole[];
  initialUsers: UserWithMeta[];
}

const TABS = [
  { key: "roles" as const, label: "Роли" },
  { key: "users" as const, label: "Пользователи" },
];

export function SettingsTabs({ initialRoles, initialUsers }: Props) {
  const [tab, setTab] = useState<"roles" | "users">("roles");

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Tab bar */}
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
                ? { background: "var(--accent-glow)", color: "var(--accent-400)",
                    border: "1px solid rgba(139,92,246,0.3)" }
                : { color: "var(--text-secondary)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "roles" ? (
          <RolesTab initialRoles={initialRoles} />
        ) : (
          <UsersTab initialUsers={initialUsers} roles={initialRoles} />
        )}
      </div>
    </div>
  );
}