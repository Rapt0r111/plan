"use client";

import { useState } from "react";
import { EpicCard } from "@/widgets/epic-card/EpicCard";
import { EpicWorkspace } from "@/features/epics/EpicWorkspace"; // Check path
import type { EpicSummary, TaskView } from "@/shared/types";

export function EpicInteractionLayer({ epics }: { epics: EpicSummary[] }) {
  const [activeEpicId, setActiveEpicId] = useState<number | null>(null);

  const selectedEpic = epics.find((e) => e.id === activeEpicId);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {epics.map((epic, index) => (
          <EpicCard
            key={epic.id}
            epic={epic}
            index={index}
            // Now we are passing the function!
            onOpen={(id) => setActiveEpicId(id)}
          />
        ))}
      </div>

      {activeEpicId && selectedEpic && (
        <EpicWorkspace
          epicId={activeEpicId}
          summary={selectedEpic}
          onClose={() => setActiveEpicId(null)}
          onOpenTask={(task: TaskView) => {
             // Logic for opening task details later
             console.log("Open task:", task.title);
          }}
        />
      )}
    </>
  );
}