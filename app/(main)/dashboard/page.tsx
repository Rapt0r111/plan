import { getAllEpics } from "@/entities/epic/epicRepository";
import { getAllUsers } from "@/entities/user/userRepository";
import { Header } from "@/widgets/header/Header";
import { EpicCard } from "@/widgets/epic-card/EpicCard";
import { RoleBadge } from "@/features/role-badge/RoleBadge";

export default async function DashboardPage() {
  const [epics, users] = await Promise.all([getAllEpics(), getAllUsers()]);

  const totalTasks = epics.reduce((s, e) => s + e.taskCount, 0);
  const doneTasks  = epics.reduce((s, e) => s + e.doneCount, 0);
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div>
      <Header
        title="Обзор"
        subtitle={`${epics.length} эпиков · ${totalTasks} задач · ${overallPct}% выполнено`}
      />

      <div className="p-6 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Всего задач",  value: totalTasks,              color: "#6366f1" },
            { label: "Выполнено",    value: doneTasks,               color: "#10b981" },
            { label: "В работе",     value: totalTasks - doneTasks,  color: "#f59e0b" },
            { label: "Прогресс",     value: `${overallPct}%`,        color: "#8b5cf6" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
              <p
                className="text-2xl font-semibold font-mono"
                style={{ color: stat.color }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Epics grid */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Эпики</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {epics.map((epic) => (
              <EpicCard key={epic.id} epic={epic} />
            ))}
          </div>
        </section>

        {/* Team */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Команда</h2>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {users.map((user) => (
              <div key={user.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                  {user.initials}
                </div>
                <span className="text-sm font-medium text-slate-800 flex-1">{user.name}</span>
                <RoleBadge roleMeta={user.roleMeta} size="sm" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}