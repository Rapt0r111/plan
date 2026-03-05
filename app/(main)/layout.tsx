/**
 * @file layout.tsx — app/(main)
 *
 * БЫЛО:
 *   await Promise.all([getAllEpics(), getAllUsers()]) — блокировал рендер
 *   всего layout (и значит весь контент страницы) до завершения SQL-запросов.
 *   Пользователь видел белый экран всё время, пока грузился сайдбар.
 *
 * СТАЛО:
 *   Сайдбар вынесен в отдельный async Server Component (SidebarLoader),
 *   обёрнутый в <Suspense>. Это даёт React/Next.js два преимущества:
 *
 *   1. STREAMING: браузер получает HTML контентной части (<main>)
 *      немедленно, не дожидаясь SQL для сайдбара. FCP и LCP падают.
 *
 *   2. ПАРАЛЛЕЛЬНОСТЬ: Next.js рендерит сайдбар и дочерние страницы
 *      параллельно (не последовательно). Если страница тоже делает
 *      fetch, они идут одновременно — суммарное время = max(t1, t2),
 *      а не t1 + t2.
 *
 *   3. React.cache() в репозитории дедуплицирует: если SidebarLoader
 *      и дочерняя страница оба вызывают getAllEpics() / getAllUsers(),
 *      SQL уходит ровно один раз.
 *
 * SidebarSkeleton: минималистичный placeholder нужной ширины,
 * устраняет layout shift при гидрации.
 */
import { Suspense } from "react";
import { Sidebar } from "@/widgets/sidebar/Sidebar";
import { getAllEpics } from "@/entities/epic/epicRepository";
import { getAllUsers } from "@/entities/user/userRepository";

// ── Async Server Component для сайдбара ──────────────────────────────────────
// Вынесен отдельно, чтобы <Suspense> мог стримить его независимо от <main>.
async function SidebarLoader() {
  const [epics, users] = await Promise.all([getAllEpics(), getAllUsers()]);
  return <Sidebar epics={epics} users={users} />;
}

// ── Скелетон сайдбара ─────────────────────────────────────────────────────────
// Отображается пока SidebarLoader грузится.
// Имеет точно такую же ширину, чтобы <main> не прыгал при появлении сайдбара.
function SidebarSkeleton() {
  return (
    <aside
      className="fixed left-0 top-0 h-screen z-20 flex flex-col overflow-hidden"
      style={{ width: "var(--sidebar-w)" }}
    >
      {/* Deep background — совпадает с реальным сайдбаром */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c0d1e] to-[var(--bg-base)]" />
      <div className="absolute inset-y-0 right-0 w-px bg-[var(--glass-border)]" />

      <div className="relative flex flex-col h-full px-3 pt-4 gap-3 animate-pulse">
        {/* Logo placeholder */}
        <div
          className="h-14 rounded-xl mx-2 mb-2"
          style={{ background: "var(--glass-02)" }}
        />
        {/* Nav items */}
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-9 rounded-xl"
            style={{ background: "var(--glass-01)" }}
          />
        ))}
        {/* Progress block */}
        <div
          className="h-14 rounded-xl mt-1"
          style={{ background: "var(--glass-01)" }}
        />
        {/* Epic list items */}
        <div className="flex flex-col gap-1 flex-1 mt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-9 rounded-xl"
              style={{
                background: "var(--glass-01)",
                opacity: 1 - i * 0.12,
              }}
            />
          ))}
        </div>
        {/* Footer */}
        <div
          className="h-10 rounded-xl mb-2"
          style={{ background: "var(--glass-01)" }}
        />
      </div>
    </aside>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/*
       * Suspense + SidebarLoader:
       *  - SidebarSkeleton рендерится мгновенно (0ms)
       *  - SidebarLoader стримится как только SQL завершится
       *  - <main> с children не ждёт сайдбар
       */}
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarLoader />
      </Suspense>

      <main
        className="flex-1 flex flex-col overflow-hidden"
        style={{ marginLeft: "var(--sidebar-w)" }}
      >
        {/* Top ambient glow */}
        <div className="pointer-events-none fixed top-0 left-(--sidebar-w) right-0 h-64 bg-linear-to-b from-[rgba(139,92,246,0.04)] to-transparent z-0" />
        <div className="flex-1 overflow-y-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}