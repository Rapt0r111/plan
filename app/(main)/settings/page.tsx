/**
 * @file page.tsx — app/(main)/settings
 *
 * UPDATED v2: fetches epics with tasks for Epics & Tasks CRUD tabs.
 */
import { getAllRoles } from "@/entities/role/roleRepository";
import { getAllUsers } from "@/entities/user/userRepository";
import { getAllEpicsWithTasks } from "@/entities/epic/epicRepository";
import { Header } from "@/widgets/header/Header";
import { SettingsTabs } from "./SettingsTabs";

export default async function SettingsPage() {
  const [roles, users, epics] = await Promise.all([
    getAllRoles(),
    getAllUsers(),
    getAllEpicsWithTasks(),
  ]);

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
      />
    </div>
  );
}