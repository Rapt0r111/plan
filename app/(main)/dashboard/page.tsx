/**
 * @file page.tsx — app/(main)/dashboard
 *
 * ═══════════════════════════════════════════════════════════════
 * STREAMING ARCHITECTURE — v4
 * ═══════════════════════════════════════════════════════════════
 *
 * FIX v4 (антипаттерн #4 из code review):
 *   БЫЛО: getAllEpics() + getAllEpicsWithTasks() — ДВА запроса для дашборда.
 *   getAllEpicsWithTasks() уже содержит все данные из getAllEpics().
 *   Дублирование давало лишний SQL без какой-либо выгоды.
 *
 *   СТАЛО:
 *   - FAST path: getAllEpics() только для быстрых виджетов (stats, header)
 *   - SLOW path (Suspense): getAllEpicsWithTasks() для StoreHydrator + виджетов.
 *     EpicInteractionLayer теперь получает данные из HeavyWidgets через
 *     store hydration + Suspense, вместо отдельного вызова на уровне страницы.
 *
 *   Почему это важно:
 *   getAllEpicsWithTasks() возвращает тот же набор эпиков + задачи/подзадачи.
 *   EpicSummary (для EpicInteractionLayer) вычисляется из EpicWithTasks
 *   без дополнительного SQL — просто маппинг.
 *
 * АРХИТЕКТУРА (итоговая):
 *   Быстро (<50ms): getAllEpics() → stats, header subtitle
 *   Медленно (Suspense): getAllEpicsWithTasks() → store + epics grid + workload
 */

import { Suspense } from "react";
import { getAllEpics } from "@/entities/epic/epicRepository";
import { getAllEpicsWithTasks } from "@/entities/epic/epicRepository";
import { getAllUsers } from "@/entities/user/userRepository";
import { Header } from "@/widgets/header/Header";
import { RoleBadge } from "@/features/role-badge/RoleBadge";
import { StoreHydrator } from "@/shared/store/StoreHydrator";
import { DashboardClientWidgets } from "./DashboardClientWidgets";
import Link from "next/link";
import { EpicInteractionLayer } from "./EpicInteractionLayer";
import type { EpicSummary } from "@/shared/types";

export const dynamic = "force-dynamic";


// ─── Async компонент для тяжёлых виджетов ────────────────────────────────────
// getAllEpicsWithTasks() включает все данные из getAllEpics() — дублирование убрано.
async function HeavyWidgets() {
  const epicsWithTasks = await getAllEpicsWithTasks();

  // Вычисляем EpicSummary из EpicWithTasks — без лишнего SQL-запроса
  const epicSummaries: EpicSummary[] = epicsWithTasks.map((e) => ({
    id:          e.id,
    title:       e.title,
    description: e.description,
    color:       e.color,
    startDate:   e.startDate,
    endDate:     e.endDate,
    createdAt:   e.createdAt,
    updatedAt:   e.updatedAt,
    taskCount:   e.progress.total,
    doneCount:   e.progress.done,
  }));

  return (
    <>
      <StoreHydrator epics={epicsWithTasks} />

      {/* ── Эпики (рендерятся после загрузки задач) ── */}
      <section>
        <h2 className="text-xs font-semibold text-(--text-muted) uppercase tracking-widest mb-3">
          Эпики
        </h2>
        <EpicInteractionLayer epics={epicSummaries} />
      </section>

      {/* ── Тяжёлые виджеты ── */}
      <DashboardClientWidgets />
    </>
  );
}

// ─── Скелетон ─────────────────────────────────────────────────────────────────
function HeavyWidgetsSkeleton() {
  return (
    <>
      {/* Epics grid skeleton */}
      <section>
        <div className="h-3 w-12 rounded mb-3 animate-pulse" style={{ background: "var(--glass-02)" }} />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden animate-pulse"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
                borderLeft: "3px solid var(--glass-03)",
                height: 140,
              }}
            />
          ))}
        </div>
      </section>

      {/* Workload skeleton */}
      <section>
        <div className="h-3 w-24 rounded mb-3 animate-pulse" style={{ background: "var(--glass-02)" }} />
        <div
          className="rounded-2xl overflow-hidden animate-pulse"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", height: 56 }}
        />
      </section>

      {/* Timeline skeleton */}
      <section>
        <div className="h-3 w-24 rounded mb-3 animate-pulse" style={{ background: "var(--glass-02)" }} />
        <div
          className="rounded-2xl animate-pulse"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", height: 200 }}
        />
      </section>
    </>
  );
}

// ─── Главная страница ─────────────────────────────────────────────────────────
export default async function DashboardPage() {
  /*
   * БЫСТРЫЕ запросы — рендерим немедленно:
   *   getAllEpics()  → 1 SQL (только суммарные данные для stats/header)
   *   getAllUsers()  → 1 SQL
   *   Итого: 2 запроса параллельно, ~15–30 мс на SQLite.
   *
   * Эпики для EpicInteractionLayer теперь приходят из HeavyWidgets
   * чтобы избежать дублирования getAllEpics() + getAllEpicsWithTasks().
   */
  const [epics, users] = await Promise.all([
    getAllEpics(),
    getAllUsers(),
  ]);

  const totalTasks = epics.reduce((s, e) => s + e.taskCount, 0);
  const doneTasks = epics.reduce((s, e) => s + e.doneCount, 0);
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const stats = [
    { label: "Всего задач", value: totalTasks, color: "#a78bfa" },
    { label: "Выполнено", value: doneTasks, color: "#34d399" },
    { label: "В работе", value: totalTasks - doneTasks, color: "#38bdf8" },
    { label: "Прогресс", value: `${overallPct}%`, color: "#f59e0b" },
  ];

  return (
    <div>
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
        {/* ── Статистика (рендерится мгновенно) ─────────────────────── */}
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

        {/* ── Команда (рендерится мгновенно) ────────────────────────── */}
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
                <span className="text-sm font-medium text-(--text-primary) flex-1">
                  {user.name}
                </span>
                <RoleBadge roleMeta={user.roleMeta} size="sm" />
              </div>
            ))}
          </div>
        </section>

        {/*
         * ── Тяжёлые виджеты + Эпики (стримятся вместе) ────────────────
         *
         * FIX: EpicInteractionLayer перемещён внутрь HeavyWidgets.
         * Теперь данные для grid эпиков вычисляются из getAllEpicsWithTasks()
         * как EpicSummary маппинг — без отдельного SQL-запроса.
         *
         * Порядок рендера:
         *   1. Stats + Team → мгновенно (~30 мс)
         *   2. Epics grid + Workload + Timeline → как только getAllEpicsWithTasks() завершится
         */}
        <Suspense fallback={<HeavyWidgetsSkeleton />}>
          <HeavyWidgets />
        </Suspense>
      </div>
    </div>
  );
}