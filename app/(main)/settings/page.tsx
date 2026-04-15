/**
 * @file page.tsx — app/(main)/settings
 * UPDATED: passes isAdmin so audit tab is only visible to admins.
 */
import { getAllRoles } from "@/entities/role/roleRepository";
import { getAllUsers } from "@/entities/user/userRepository";
import { getAllEpicsWithTasks } from "@/entities/epic/epicRepository";
import { Header } from "@/widgets/header/Header";
import { SettingsTabs } from "./SettingsTabs";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [roles, users, epics, session] = await Promise.all([
    getAllRoles(),
    getAllUsers(),
    getAllEpicsWithTasks(),
    auth.api.getSession({ headers: await headers() }),
  ]);

  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Настройки"
        subtitle={`${roles.length} ролей · ${users.length} пользователей · ${epics.length} эпиков`}
        actions={
          isAdmin && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: "rgba(139,92,246,0.12)",
                border: "1px solid rgba(139,92,246,0.3)",
                color: "#a78bfa",
              }}
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M6 1l1.5 3H11L8.5 6l1 3L6 7.5 2.5 9l1-3L1 4h3.5z" />
              </svg>
              Администратор
            </div>
          )
        }
      />
      <SettingsTabs
        initialRoles={roles}
        initialUsers={users}
        initialEpics={epics}
        isAdmin={isAdmin}
      />
    </div>
  );
}