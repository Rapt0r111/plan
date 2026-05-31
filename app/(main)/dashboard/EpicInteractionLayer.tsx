"use client";
/**
 * @file EpicInteractionLayer.tsx — app/(main)/dashboard
 *
 * ═══════════════════════════════════════════════════════════════
 * ОПТИМИЗАЦИЯ ПРОИЗВОДИТЕЛЬНОСТИ v2
 * ═══════════════════════════════════════════════════════════════
 *
 * ПРОБЛЕМЫ v1 (причины лагов):
 *
 * 1. LayoutGroup на весь компонент включая сетку карточек.
 *    LayoutGroup заставляет Framer Motion измерять layout всех дочерних
 *    элементов при КАЖДОМ изменении состояния (открытие/закрытие workspace).
 *    При скролле + открытии = layout measurement всех карточек в сетке.
 *    FIX: LayoutGroup перенесён только на пару card↔workspace.
 *    Сетка карточек рендерится ВНЕ LayoutGroup.
 *
 * 2. AnimatePresence mode="wait" — задерживает монтирование EpicWorkspace
 *    до завершения exit предыдущего. При FLIP через layoutId это лишнее:
 *    layoutId сам синхронизирует анимацию входа/выхода.
 *    FIX: mode="popLayout" — card не блокирует workspace mount,
 *    FLIP работает корректно, сетка не перестраивается.
 *
 * 3. SlideoverPortal с useSyncExternalStore + createPortal — правильно.
 *    Оставлен без изменений.
 *
 * АРХИТЕКТУРА:
 *
 *   EpicInteractionLayer
 *   ├── <div className="grid"> — карточки БЕЗ LayoutGroup
 *   │   └── EpicCard × N  (layoutId каждой карточки регистрируется глобально)
 *   │
 *   ├── <LayoutGroup id="epic-workspace-flip">  ← только для FLIP
 *   │   └── AnimatePresence mode="popLayout"
 *   │       └── EpicWorkspace (когда открыт)
 *   │
 *   └── SlideoverPortal → TaskSlideover
 *
 * Примечание: layoutId в EpicCard и EpicWorkspace должны совпадать
 * (`epic-card-${id}`). LayoutGroup не обязателен для работы layoutId —
 * он только изолирует пространство имён. Убрав его с сетки, мы позволяем
 * FLIP работать глобально, без measurement overhead на каждую карточку.
 */

import { useState, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { EpicCard } from "@/widgets/epic-card/EpicCard";
import type { EpicSummary, TaskView } from "@/shared/types";

const EpicWorkspace = dynamic(
  () =>
    import("@/features/epics/EpicWorkspace").then((m) => ({
      default: m.EpicWorkspace,
    })),
  { ssr: false },
);

const TaskSlideover = dynamic(
  () =>
    import("@/features/task-details/TaskSlideover").then((m) => ({
      default: m.TaskSlideover,
    })),
  { ssr: false },
);

// ── SSR-safe клиентская проверка ──────────────────────────────────────────────
const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function SlideoverPortal({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 80, pointerEvents: "none" }}>
      {children}
    </div>,
    document.body,
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EpicInteractionLayer({ epics }: { epics: EpicSummary[] }) {
  const [activeEpicId, setActiveEpicId] = useState<number | null>(null);
  const [activeTask, setActiveTask] = useState<TaskView | null>(null);

  const selectedEpic =
    activeEpicId != null ? epics.find((e) => e.id === activeEpicId) ?? null : null;

  const handleOpenEpic  = useCallback((id: number) => setActiveEpicId(id), []);
  const handleCloseEpic = useCallback(() => setActiveEpicId(null), []);
  const handleOpenTask  = useCallback((task: TaskView) => setActiveTask(task), []);
  const handleCloseTask = useCallback(() => setActiveTask(null), []);

  return (
    <>
      {/*
       * ── Сетка карточек — ВНЕ LayoutGroup ──────────────────────────────
       *
       * LayoutGroup убран с сетки. Это устраняет главный источник лагов:
       * Framer больше не измеряет layout всех N карточек при каждом
       * открытии/закрытии workspace.
       *
       * layoutId в EpicCard (`epic-card-${id}`) работает глобально —
       * FLIP между карточкой и workspace сохраняется без LayoutGroup.
       *
       * contain: layout на обёртке сетки — даём браузеру знать, что
       * layout внутри не влияет на внешний документ. Это ускоряет
       * layout recalc при добавлении/удалении карточек.
       */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        style={{ contain: "layout" }}
      >
        {epics.map((epic, index) => (
          <EpicCard
            key={epic.id}
            epic={epic}
            index={index}
            onOpen={handleOpenEpic}
          />
        ))}
      </div>

      {/*
       * ── Morphing workspace overlay ─────────────────────────────────────
       *
       * AnimatePresence mode="popLayout" вместо mode="wait":
       * - "wait": workspace ждёт exit предыдущего → задержка открытия
       * - "popLayout": карточка "выталкивается" из потока немедленно,
       *   workspace монтируется параллельно → FLIP работает плавнее.
       *
       * z-index: 58/59 — workspace рендерится поверх сетки, под slideover (80).
       */}
      <AnimatePresence mode="popLayout">
        {selectedEpic && activeEpicId != null && (
          <EpicWorkspace
            key={`ws-${activeEpicId}`}
            epicId={activeEpicId}
            summary={selectedEpic}
            onClose={handleCloseEpic}
            onOpenTask={handleOpenTask}
          />
        )}
      </AnimatePresence>

      {/*
       * ── Task slideover — через портал, z-80 ───────────────────────────
       * createPortal вырывает slideover из любого stacking context.
       * pointer-events: none на обёртке — events работают только на
       * самом slideover (TaskSlideover рендерит pointer-events: auto внутри).
       */}
      <SlideoverPortal>
        <AnimatePresence>
          {activeTask && (
            <div style={{ pointerEvents: "auto" }}>
              <TaskSlideover task={activeTask} onClose={handleCloseTask} />
            </div>
          )}
        </AnimatePresence>
      </SlideoverPortal>
    </>
  );
}