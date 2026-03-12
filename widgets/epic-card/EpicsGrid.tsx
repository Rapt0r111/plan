"use client";
/**
 * @file EpicsGrid.tsx — widgets/epic-card
 *
 * ═══════════════════════════════════════════════════════
 * EPICS GRID — MORPHING ORCHESTRATOR
 * ═══════════════════════════════════════════════════════
 *
 * Управляет переходом между состояниями:
 *   GRID  → EpicCard  ×N  (layoutId = `epic-card-${id}`)
 *   OPEN  → EpicWorkspace  (layoutId = `epic-card-${selectedId}`)
 *
 * AnimatePresence mode="wait" критичен: гарантирует что Workspace
 * монтируется только ПОСЛЕ завершения exit-анимации предыдущего
 * (хотя здесь exit и enter параллельны — layoutId это обрабатывает).
 *
 * TaskSlideover инициируется из EpicWorkspace через onOpenTask callback.
 * EpicsGrid держит ссылку на открытую задачу — это позволяет Slideover
 * работать независимо от состояния воркспейса.
 *
 * ИНТЕГРАЦИЯ В dashboard/page.tsx:
 *
 *   // Заменить существующий блок:
 *   // <div className="grid ...">
 *   //   {epics.map((epic, index) => (
 *   //     <EpicCard key={epic.id} epic={epic} index={index} />
 *   //   ))}
 *   // </div>
 *
 *   // На:
 *   <EpicsGrid epics={epics} />
 */

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { EpicCard } from "./EpicCard";
import type { EpicSummary, TaskView } from "@/shared/types";

// Workspace грузится лениво — не нужен до первого клика
const EpicWorkspace = dynamic(
    () => import("@/features/epics/EpicWorkspace").then((m) => ({ default: m.EpicWorkspace })),
    { ssr: false }
);

// TaskSlideover грузится лениво — тяжёлый компонент
const TaskSlideover = dynamic(
    () => import("@/features/task-details/TaskSlideover").then((m) => ({ default: m.TaskSlideover })),
    { ssr: false }
);

interface Props {
    epics: EpicSummary[];
}

export function EpicsGrid({ epics }: Props) {
    const [selectedEpicId, setSelectedEpicId] = useState<number | null>(null);
    const [activeTask, setActiveTask] = useState<TaskView | null>(null);

    const selectedEpic = selectedEpicId != null
        ? epics.find((e) => e.id === selectedEpicId) ?? null
        : null;

    const handleOpenEpic = useCallback((epicId: number) => {
        setSelectedEpicId(epicId);
    }, []);

    const handleCloseEpic = useCallback(() => {
        setSelectedEpicId(null);
    }, []);

    const handleOpenTask = useCallback((task: TaskView) => {
        setActiveTask(task);
    }, []);

    const handleCloseTask = useCallback(() => {
        setActiveTask(null);
    }, []);

    return (
        <>
            {/* ── Epic cards grid ── */}
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

            {/* ── Morphing workspace overlay ── */}
            <AnimatePresence>
                {selectedEpic && selectedEpicId != null && (
                    <EpicWorkspace
                        key={`ws-${selectedEpicId}`}
                        epicId={selectedEpicId}
                        summary={selectedEpic}
                        onClose={handleCloseEpic}
                        onOpenTask={handleOpenTask}
                    />
                )}
            </AnimatePresence>

            {/* ── Task slideover (from workspace) ── */}
            {activeTask && (
                <TaskSlideover
                    task={activeTask}
                    onClose={handleCloseTask}
                />
            )}
        </>
    );
}