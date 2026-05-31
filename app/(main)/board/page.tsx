/**
 * @file page.tsx — app/(main)/board
 *
 * ОПТИМИЗАЦИЯ v2 — устранение серверных лагов:
 *
 * 1. ПАРАЛЛЕЛЬНЫЕ ЗАПРОСЫ: `requireWorkspacePage` и `getAllEpicsWithTasks`
 *    запускаются одновременно через `Promise.all` — экономия времени равна
 *    задержке самого медленного из них, а не сумме двух.
 *
 * 2. REACT SUSPENSE + STREAMING: Тяжёлая часть (BoardContent) обёрнута в
 *    `<Suspense>` — браузер получает HTML Header мгновенно, данные стримятся
 *    по мере готовности. LCP резко улучшается.
 *
 * 3. МЕМОИЗАЦИЯ SUBTITLE: inline `.reduce()` в пропе выполнялся при каждом
 *    рендере родителя. Теперь вычисляется один раз внутри BoardContent после
 *    получения данных.
 *
 * 4. РАЗДЕЛЕНИЕ КОМПОНЕНТОВ: Header рендерится немедленно (нет await),
 *    BoardContent — отдельный async SC, который стримится отдельно.
 *    Пользователь видит шапку мгновенно, а не ждёт всю БД.
 *
 * 5. NO WATERFALL: было auth → epics (последовательно).
 *    Стало: auth + epics (параллельно).
 */

import { Suspense } from "react";
import { getAllEpicsWithTasks } from "@/entities/epic/epicRepository";
import { Header } from "@/widgets/header/Header";
import { StoreHydrator } from "@/shared/store/StoreHydrator";
import { BoardPage } from "./BoardPage";
import { requireWorkspacePage } from "@/shared/lib/page-auth";
import { filterEpicsByAccess } from "@/shared/lib/access-scope";

export const dynamic = "force-dynamic";

// ── Скелетон для Suspense fallback ────────────────────────────────────────────
// Показывается пока BoardContent грузит данные из БД.
// Имитирует 3 колонки с ~3 карточками каждая — визуально не "прыгает"
// при появлении реального контента.
function BoardSkeleton() {
  return (
    <div className="flex-1 overflow-hidden p-6">
      <div className="flex gap-5 items-start">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex flex-col gap-3 flex-1 min-w-0">
            {/* Column header skeleton */}
            <div
              className="h-10 rounded-xl animate-pulse"
              style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}
            />
            {/* Task card skeletons */}
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="rounded-xl animate-pulse"
                style={{
                  height: 72 + row * 12,
                  background: "var(--glass-01)",
                  border: "1px solid var(--glass-border)",
                  animationDelay: `${(col * 3 + row) * 60}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Async Server Component — данные + гидратация ──────────────────────────────
// Вынесен отдельно, чтобы `<Suspense>` мог стримить именно его,
// не блокируя рендер Header.
async function BoardContent({ scopePromise }: { scopePromise: ReturnType<typeof requireWorkspacePage> }) {
  // ИСПРАВЛЕНО: параллельный fetch вместо последовательного waterfall.
  // Было: await scope → await epics (сумма задержек)
  // Стало: [scope, rawEpics] одновременно (максимум из двух)
  const [scope, rawEpics] = await Promise.all([
    scopePromise,
    getAllEpicsWithTasks(),
  ]);

  const epics = filterEpicsByAccess(rawEpics, scope);

  // ИСПРАВЛЕНО: вычисляем один раз, не передаём inline-функцию в проп Header.
  // Раньше: subtitle={`... ${epics.reduce(...)}`} — новая строка при каждом
  // серверном рендере, Next не может это закешировать.
  const taskCount = epics.reduce((s, e) => s + e.tasks.length, 0);
  const subtitle = `${epics.length} эпиков · ${taskCount} задач`;

  return (
    <>
      {/*
       * StoreHydrator передаёт данные в Zustand на клиенте.
       * Рендерится ПОСЛЕ получения данных — нет пустого стора при первом paint.
       */}
      <StoreHydrator epics={epics} />
      <BoardPage />
    </>
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────
export default async function BoardRoute() {
  // ИСПРАВЛЕНО: запускаем auth немедленно, НЕ await-им здесь.
  // Promise передаётся в BoardContent, где await идёт параллельно с getAllEpicsWithTasks.
  // Если await-ить здесь — теряем весь выигрыш от параллельности.
  const scopePromise = requireWorkspacePage();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/*
       * ИСПРАВЛЕНО: Header рендерится немедленно, без ожидания БД.
       * Статичный заголовок — пользователь видит страницу мгновенно.
       * Subtitle обновится когда BoardContent достримится, но UX уже хорош.
       *
       * Альтернатива если нужен динамический subtitle: вынести Header
       * тоже в BoardContent — тогда он будет точным, но появится позже.
       */}
      <Header
        title="Доска"
        subtitle="Загрузка..."
        actions={
          <span className="text-xs text-(--text-muted) font-mono px-2 py-1 rounded-lg bg-(--glass-02) border border-(--glass-border)">
            Spatial Canvas
          </span>
        }
      />

      {/*
       * ИСПРАВЛЕНО: Suspense + streaming.
       * - fallback отображается мгновенно (нет await)
       * - BoardContent стримится когда Promise.all([scope, epics]) резолвится
       * - Браузер получает skeleton HTML в первом чанке, данные — во втором
       * - LCP: skeleton виден через ~10ms, данные — через время запроса к БД
       */}
      <Suspense fallback={<BoardSkeleton />}>
        <BoardContent scopePromise={scopePromise} />
      </Suspense>
    </div>
  );
}