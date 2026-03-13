"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup } from "framer-motion";
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

// SSR-safe способ проверить что мы на клиенте — без setState внутри useEffect.
// useSyncExternalStore: serverSnapshot=false, clientSnapshot=true → рендер портала
// только после гидрации, без предупреждений линтера.
const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function SlideoverPortal({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(
    // z-[80] > z-59 (workspace panel) > z-58 (workspace backdrop)
    <div style={{ position: "fixed", inset: 0, zIndex: 80, pointerEvents: "none" }}>
      {children}
    </div>,
    document.body,
  );
}

export function EpicInteractionLayer({ epics }: { epics: EpicSummary[] }) {
  const [activeEpicId, setActiveEpicId] = useState<number | null>(null);
  const [activeTask, setActiveTask] = useState<TaskView | null>(null);

  const selectedEpic =
    activeEpicId != null ? epics.find((e) => e.id === activeEpicId) ?? null : null;

  const handleOpenEpic = useCallback((id: number) => setActiveEpicId(id), []);
  const handleCloseEpic = useCallback(() => setActiveEpicId(null), []);

  // Задача открывается поверх workspace — эпик НЕ закрываем
  const handleOpenTask = useCallback((task: TaskView) => setActiveTask(task), []);
  const handleCloseTask = useCallback(() => setActiveTask(null), []);

  return (
    <LayoutGroup id="epics-dashboard">
      {/* ── Сетка карточек ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {epics.map((epic, index) => (
          <EpicCard
            key={epic.id}
            epic={epic}
            index={index}
            onOpen={handleOpenEpic}
          />
        ))}
      </div>

      {/* ── Morphing workspace (z-58/59) ── */}
      <AnimatePresence mode="wait">
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

      {/* ── Task slideover — через портал в document.body, z-80 ──
          createPortal вырывает slideover из любого stacking context
          (в т.ч. из workspace с z-59), гарантируя рендер поверх всего. */}
      <SlideoverPortal>
        <AnimatePresence>
          {activeTask && (
            // pointer-events: auto только на самом slideover
            <div style={{ pointerEvents: "auto" }}>
              <TaskSlideover task={activeTask} onClose={handleCloseTask} />
            </div>
          )}
        </AnimatePresence>
      </SlideoverPortal>
    </LayoutGroup>
  );
}