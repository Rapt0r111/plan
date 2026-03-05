"use client";
/**
 * @file DashboardClientWidgets.tsx — app/(main)/dashboard
 *
 * Client Component — обёртка для тяжёлых виджетов дашборда.
 *
 * ПРИЧИНА ВЫДЕЛЕНИЯ:
 *  dynamic() с { ssr: false } нельзя использовать в Server Components (Next.js 16).
 *  dashboard/page.tsx — Server Component, поэтому dynamic-импорты вынесены сюда.
 *
 *  HeavyWidgets (server async) → DashboardClientWidgets (client) → lazy chunks.
 *
 * ЭФФЕКТ:
 *  WorkloadBalancer и InfiniteTimeline грузятся отдельными JS-чанками,
 *  параллельно с рендером страницы, а не блокируют первичный бандл.
 */
import dynamic from "next/dynamic";

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

export function DashboardClientWidgets() {
  return (
    <>
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