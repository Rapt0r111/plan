/**
 * @file page.tsx — app/(main)/board
 * Server Component: fetches all epics with full task data, hydrates store,
 * renders BoardPage client component.
 *
 * This pattern keeps the initial HTML server-rendered (SEO/LCP) while
 * enabling full client-side reactivity after hydration.
 */
import { getAllEpicsWithTasks } from "@/entities/epic/epicRepository";
import { Header } from "@/widgets/header/Header";
import { StoreHydrator } from "@/shared/store/StoreHydrator";
import { BoardPage } from "./BoardPage";

// `/board` зависит от содержимого SQLite.
// По умолчанию Next может попытаться его статически пререндерить во время `next build`,
// а затем отдать "запечённые" пустые данные на runtime.
// Принудительно делаем динамический рендер, чтобы данные брались после seed/migrations.
export const dynamic = "force-dynamic";

export default async function BoardRoute() {
  const epics = await getAllEpicsWithTasks();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Доска"
        subtitle={`${epics.length} эпиков · ${epics.reduce((s, e) => s + e.tasks.length, 0)} задач`}
        actions={
          <span className="text-xs text-(--text-muted) font-mono px-2 py-1 rounded-lg bg-(--glass-02) border border-(--glass-border)">
            Spatial Canvas
          </span>
        }
      />
      {/* Hydrate Zustand with full task data for optimistic DnD */}
      <StoreHydrator epics={epics} />
      <BoardPage />
    </div>
  );
}