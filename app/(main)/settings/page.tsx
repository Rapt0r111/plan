/**
 * @file page.tsx — app/(main)/settings
 *
 * UPDATED v3:
 *   - Passes isAdmin and currentUserEmail to SettingsTabs
 *   - Shows Audit tab only for admin users
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
      />
      <SettingsTabs
        initialRoles={roles}
        initialUsers={users}
        initialEpics={epics}
        isAdmin={isAdmin}
        currentUserEmail={session?.user?.email}
      />
    </div>
  );
}