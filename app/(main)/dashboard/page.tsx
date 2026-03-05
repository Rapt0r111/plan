/**
 * @file page.tsx — app/(main)/dashboard
 *
 * БЫЛО:
 *   Promise.all([getAllEpics(), getAllEpicsWithTasks(), getAllUsers()])
 *   → getAllEpics() вызывался отдельно для статистики, хотя те же данные
 *     уже есть в getAllEpicsWithTasks(). Двойной SQL-проход.
 *
 * СТАЛО:
 *   Promise.all([getAllEpicsWithTasks(), getAllUsers()])
 *   → статистика (taskCount, doneCount) вычисляется из полного графа
 *     на клиенте (O(N) JS, ~0ms). Один SQL-проход.
 *
 * WHY getAllEpicsWithTasks() здесь:
 *  EnergyMap и InfiniteTimeline читают из Zustand store.
 *  Стор гидрируется StoreHydrator — ему нужен полный граф задач.
 *  getAllEpics() возвращает только счётчики, а не сам граф.
 */
import { getAllEpicsWithTasks } from "@/entities/epic/epicRepository";
import { getAllUsers } from "@/entities/user/userRepository";
import { Header } from "@/widgets/header/Header";
import { EpicCard } from "@/widgets/epic-card/EpicCard";
import { RoleBadge } from "@/features/role-badge/RoleBadge";
import { WorkloadBalancer } from "@/features/workload/WorkloadBalancer";
import { InfiniteTimeline } from "@/features/timeline/InfiniteTimeline";
import { StoreHydrator } from "@/shared/store/StoreHydrator";
import Link from "next/link";

export default async function DashboardPage() {
  // Один вызов вместо двух — getAllEpics() больше не нужен.
  // React.cache() в репозитории гарантирует: даже если layout.tsx тоже
  // вызвал getAllEpicsWithTasks(), SQL уйдёт ровно один раз.
  const [epicsWithTasks, users] = await Promise.all([
    getAllEpicsWithTasks(),
    getAllUsers(),
  ]);

  // Вычисляем то, что раньше давал getAllEpics() — из уже загруженных данных
  const epics = epicsWithTasks.map((e) => ({
    ...e,
    taskCount: e.tasks.length,
    doneCount: e.tasks.filter((t) => t.status === "done").length,
  }));

  const totalTasks = epics.reduce((s, e) => s + e.taskCount, 0);
  const doneTasks  = epics.reduce((s, e) => s + e.doneCount, 0);
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const stats = [
    { label: "Всего задач", value: totalTasks,              color: "#a78bfa" },
    { label: "Выполнено",   value: doneTasks,               color: "#34d399" },
    { label: "В работе",    value: totalTasks - doneTasks,  color: "#38bdf8" },
    { label: "Прогресс",    value: `${overallPct}%`,        color: "#f59e0b" },
  ];

  return (
    <div>
      {/* Hydrate Zustand with full task graph — required by EnergyMap + InfiniteTimeline */}
      <StoreHydrator epics={epicsWithTasks} />
      <Header
        title="Обзор"
        subtitle={`${epics.length} эпиков · ${totalTasks} задач · ${overallPct}% выполнено`}
        actions={
          <Link
            href="/board"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{
              background: "var(--accent-glow)",
              color: "var(--accent-400)",
              border: "1px solid rgba(139,92,246,0.3)",
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" fillOpacity="0.5" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" fillOpacity="0.5" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" />
            </svg>
            Доска
          </Link>
        }
      />

      <div className="p-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-4 transition-all"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
            >
              <p className="text-xs text-(--text-muted) mb-1.5">{s.label}</p>
              <p className="text-2xl font-semibold font-mono" style={{ color: s.color }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Epics grid */}
        <section>
          <h2 className="text-xs font-semibold text-(--text-muted) uppercase tracking-widest mb-3">
            Эпики
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {epics.map((epic, index) => (
              <EpicCard key={epic.id} epic={epic} index={index} />
            ))}
          </div>
        </section>

        {/* Team */}
        <section>
          <h2 className="text-xs font-semibold text-(--text-muted) uppercase tracking-widest mb-3">
            Команда
          </h2>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
          >
            {users.map((user, idx) => (
              <div
                key={user.id}
                className="px-4 py-3 flex items-center gap-3"
                style={{
                  borderBottom:
                    idx < users.length - 1 ? "1px solid var(--glass-border)" : "none",
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: user.roleMeta.hex }}
                >
                  {user.initials}
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)] flex-1">
                  {user.name}
                </span>
                <RoleBadge roleMeta={user.roleMeta} size="sm" />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">
            Нагрузка
          </h2>
          <WorkloadBalancer />
        </section>

        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">
            Хронолента
          </h2>
          <InfiniteTimeline />
        </section>
      </div>
    </div>
  );
}