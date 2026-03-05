/**
 * @file page.tsx — app/(main)/dashboard
 *
 * ═══════════════════════════════════════════════════════════════
 * STREAMING ARCHITECTURE — v3
 * ═══════════════════════════════════════════════════════════════
 *
 * ПРОБЛЕМА v2 (было):
 *   await getAllEpicsWithTasks() — блокировал ВЕСЬ серверный рендер.
 *   3 SQL-запроса (epics → tasks → [subtasks + assignees]) выполнялись
 *   до того, как браузер получал хоть один байт HTML.
 *   Итог: FCP = 2–3 секунды даже при горячем кеше.
 *
 * РЕШЕНИЕ v3 (стало):
 *   Два уровня данных:
 *
 *   FAST (выше сгиба): getAllEpics() + getAllUsers() — 1+1 SQL
 *     → Stats, EpicGrid, Team рендерятся немедленно (~50–80 мс).
 *
 *   SLOW (ниже сгиба): getAllEpicsWithTasks() — 3 SQL, в Suspense
 *     → WorkloadBalancer + InfiniteTimeline стримятся отдельно.
 *     → React Streaming передаёт их в браузер, как только данные готовы,
 *       не блокируя первичный HTML.
 *
 * РЕЗУЛЬТАТ:
 *   FCP падает с ~2–3 с до ~80–150 мс (только быстрые запросы).
 *   TTI не меняется — тяжёлые виджеты всё равно загружаются,
 *   но пользователь видит страницу значительно раньше.
 *
 * ПОЧЕМУ Suspense работает здесь:
 *   Next.js App Router поддерживает React Streaming из коробки.
 *   <Suspense> на сервере означает: "отправь то, что готово сейчас,
 *   и допиши остальное, когда резолвится async компонент".
 */

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getAllEpics } from "@/entities/epic/epicRepository";
import { getAllEpicsWithTasks } from "@/entities/epic/epicRepository";
import { getAllUsers } from "@/entities/user/userRepository";
import { Header } from "@/widgets/header/Header";
import { EpicCard } from "@/widgets/epic-card/EpicCard";
import { RoleBadge } from "@/features/role-badge/RoleBadge";
import { StoreHydrator } from "@/shared/store/StoreHydrator";
import Link from "next/link";

/**
 * Dynamic imports для тяжёлых client-only виджетов.
 * Оба используют Zustand (ssr: false) и тяжёлый framer-motion.
 * Выносим в отдельные JS-чанки — не блокируют первичный бандл страницы.
 */
const WorkloadBalancer = dynamic(
  () => import("@/features/workload/WorkloadBalancer").then((m) => ({ default: m.WorkloadBalancer })),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-2xl animate-pulse"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", height: 56 }}
      />
    ),
  }
);

const InfiniteTimeline = dynamic(
  () => import("@/features/timeline/InfiniteTimeline").then((m) => ({ default: m.InfiniteTimeline })),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-2xl animate-pulse"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", height: 200 }}
      />
    ),
  }
);

// ─── Async компонент для тяжёлых виджетов ────────────────────────────────────
// Вынесен отдельно — обёрнут в <Suspense> в основном компоненте.
// getAllEpicsWithTasks() не блокирует рендер страницы.
async function HeavyWidgets() {
  const epicsWithTasks = await getAllEpicsWithTasks();

  return (
    <>
      {/*
       * StoreHydrator внутри Suspense-границы:
       * клиент получит его как часть streaming-фрагмента,
       * useEffect запустится и заполнит Zustand-стор для WorkloadBalancer
       * и InfiniteTimeline.
       */}
      <StoreHydrator epics={epicsWithTasks} />

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
    </>
  );
}

// ─── Скелетон для тяжёлых виджетов ───────────────────────────────────────────
function HeavyWidgetsSkeleton() {
  return (
    <>
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
   *   getAllEpics()  → 1 SQL (LEFT JOIN + GROUP BY)
   *   getAllUsers()  → 1 SQL
   *   Итого: ~2 запроса параллельно, ожидаемое время < 30 мс на SQLite.
   */
  const [epics, users] = await Promise.all([
    getAllEpics(),
    getAllUsers(),
  ]);

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

        {/* ── Эпики (рендерятся мгновенно) ──────────────────────────── */}
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
                <span className="text-sm font-medium text-[var(--text-primary)] flex-1">
                  {user.name}
                </span>
                <RoleBadge roleMeta={user.roleMeta} size="sm" />
              </div>
            ))}
          </div>
        </section>

        {/*
         * ── Тяжёлые виджеты (стримятся отдельно) ──────────────────────
         *
         * <Suspense> здесь критичен:
         *   - HeavyWidgets вызывает getAllEpicsWithTasks() (3 SQL)
         *   - Пока он резолвится, браузер уже показывает весь контент выше
         *   - Skeleton предотвращает layout shift при появлении виджетов
         *
         * БЕЗ Suspense: вся страница ждёт 3 SQL-запроса (~500–1500 мс)
         * С   Suspense: страница приходит за ~50–100 мс, виджеты — позже
         */}
        <Suspense fallback={<HeavyWidgetsSkeleton />}>
          <HeavyWidgets />
        </Suspense>
      </div>
    </div>
  );
}