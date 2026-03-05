import { getAllRoles } from "@/entities/role/roleRepository";
import { getAllUsers } from "@/entities/user/userRepository";
import { Header } from "@/widgets/header/Header";
import { SettingsTabs } from "./SettingsTabs";

export default async function SettingsPage() {
  const [roles, users] = await Promise.all([getAllRoles(), getAllUsers()]);
  return (
    <div className="flex flex-col h-full">
      <Header title="Настройки" subtitle="Роли и пользователи" />
      <SettingsTabs initialRoles={roles} initialUsers={users} />
    </div>
  );
}