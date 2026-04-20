"use client";
/**
 * @file OperativePage.tsx — app/(main)/operative
 *
 * v4 — drag-and-drop для reorder блоков пользователей.
 *   Порядок хранится локально в useState (сессионный, не персистентный).
 *   DnD через @dnd-kit/sortable — тот же стек что у задач внутри блоков.
 */
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOperativeStore } from "@/shared/store/useOperativeStore";
import { UserTaskBlock } from "@/widgets/operative/UserTaskBlock";
import type { UserWithOperativeTasks } from "@/entities/operative/operativeRepository";
import { useState, useCallback } from "react";

interface Props {
  initialData: UserWithOperativeTasks[];
  isAdmin: boolean;
}

// ── Sortable wrapper for one user block ───────────────────────────────────────

function SortableUserBlock({
  block, isAdmin, isDragEnabled,
}: {
  block: UserWithOperativeTasks;
  isAdmin: boolean;
  isDragEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.user.id,
    disabled: !isDragEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style}>
      <UserTaskBlock
        block={block}
        isAdmin={isAdmin}
        isDragging={isDragging}
        dragHandleProps={isDragEnabled ? { ...attributes, ...listeners } : null}
      />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function OperativePage({ initialData, isAdmin }: Props) {
  const hydrate = useOperativeStore((s) => s.hydrate);
  const isHydrated = useOperativeStore((s) => s.isHydrated);
  const userBlocks = useOperativeStore((s) => s.userBlocks);

  useEffect(() => {
    hydrate(initialData);
  }, [initialData, hydrate]);

  const sourceBlocks: UserWithOperativeTasks[] = isHydrated ? userBlocks : initialData;

  // ── Local block order (session-only) ──────────────────────────────────────
  const [orderedIds, setOrderedIds] = useState<number[]>(() =>
    sourceBlocks.map((b) => b.user.id)
  );

  // Sync orderedIds when hydration adds new users
  const currentIds = sourceBlocks.map((b) => b.user.id);
  const existingSet = new Set(orderedIds);
  const toAdd = currentIds.filter((id) => !existingSet.has(id));
  if (toAdd.length > 0) {
    setOrderedIds((prev) => [...prev, ...toAdd]);
  }

  // Sort blocks by local order
  const blocks = orderedIds
    .map((id) => sourceBlocks.find((b) => b.user.id === id))
    .filter(Boolean) as UserWithOperativeTasks[];

  // ── DnD sensors ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedIds((prev) => {
      const oldIdx = prev.indexOf(Number(active.id));
      const newIdx = prev.indexOf(Number(over.id));
      return oldIdx === -1 || newIdx === -1 ? prev : arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (blocks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-full py-32 text-center"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)" }}
        >
          <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="16" cy="10" r="5" />
            <path d="M6 28a10 10 0 0 1 20 0" />
          </svg>
        </div>
        <p className="text-base font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
          Нет пользователей
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Добавьте пользователей в разделе{" "}
          <a href="/settings" className="underline" style={{ color: "var(--accent-400)" }}>
            Настройки → Пользователи
          </a>
        </p>
      </motion.div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={orderedIds}
        strategy={rectSortingStrategy}
      >
        <div
          className="p-6 grid gap-5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            alignItems: "start",
          }}
        >
          {blocks.map((block, idx) => (
            <motion.div
              key={block.user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <SortableUserBlock
                block={block}
                isAdmin={isAdmin}
                isDragEnabled={isAdmin}
              />
            </motion.div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}