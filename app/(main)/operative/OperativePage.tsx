"use client";
import { useEffect, useCallback, useMemo, memo } from "react";
import { useState } from "react";
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
import { getUserPersonnelGroupKey } from "@/shared/lib/personnel-composition";

interface Props {
  initialData: UserWithOperativeTasks[];
  isAdmin: boolean;
  currentUserId: number | null;
  groupKey: string;
}

// ── ИСПРАВЛЕНИЕ 1: memo — блок не ре-рендерится при DnD других блоков ─────────
const SortableUserBlock = memo(function SortableUserBlock({
  block, isAdmin, currentUserId, isDragEnabled,
}: {
  block: UserWithOperativeTasks;
  isAdmin: boolean;
  currentUserId: number | null;
  isDragEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.user.id,
    disabled: !isDragEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // ИСПРАВЛЕНИЕ 2: will-change только во время перетаскивания
    willChange: isDragging ? "transform" : undefined,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style}>
      <UserTaskBlock
        block={block}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        isDragging={isDragging}
        dragHandleProps={isDragEnabled ? { ...attributes, ...listeners } : null}
      />
    </div>
  );
});

// ── Main ──────────────────────────────────────────────────────────────────────

export function OperativePage({ initialData, isAdmin, currentUserId, groupKey }: Props) {
  const hydrate = useOperativeStore((s) => s.hydrate);
  const isHydrated = useOperativeStore((s) => s.isHydrated);
  const userBlocks = useOperativeStore((s) => s.userBlocks);

  useEffect(() => {
    hydrate(initialData);
  }, [initialData, hydrate]);

  const sourceBlocks: UserWithOperativeTasks[] = isHydrated ? userBlocks : initialData;

  const serverIds = useMemo(() => sourceBlocks.map((b) => b.user.id), [sourceBlocks]);
  const [localOrderedIds, setLocalOrderedIds] = useState<number[] | null>(null);

  const orderedIds = useMemo(() => {
    const base = localOrderedIds ?? serverIds;
    const serverIdSet = new Set(serverIds);
    return [
      ...base.filter((id) => serverIdSet.has(id)),
      ...serverIds.filter((id) => !base.includes(id)),
    ];
  }, [localOrderedIds, serverIds]);

  const allBlocks = useMemo(
    () => orderedIds
      .map((id) => sourceBlocks.find((b) => b.user.id === id))
      .filter(Boolean) as UserWithOperativeTasks[],
    [orderedIds, sourceBlocks],
  );

  const blocks = useMemo(
    () => allBlocks.filter((block) => getUserPersonnelGroupKey(block.user) === groupKey),
    [allBlocks, groupKey],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const visibleIds = blocks.map((block) => block.user.id);
    const oldIdx = visibleIds.indexOf(Number(active.id));
    const newIdx = visibleIds.indexOf(Number(over.id));
    if (oldIdx === -1 || newIdx === -1) return;

    const reorderedVisibleIds = arrayMove(visibleIds, oldIdx, newIdx);
    let visibleCursor = 0;
    const newOrderedIds = allBlocks.map((block) => {
      if (getUserPersonnelGroupKey(block.user) !== groupKey) return block.user.id;
      return reorderedVisibleIds[visibleCursor++] ?? block.user.id;
    });

    setLocalOrderedIds(newOrderedIds);

    if (!isAdmin) return;

    try {
      const res = await fetch("/api/operative-blocks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: newOrderedIds.map((id, i) => ({ id, blockOrder: i })),
        }),
      });
      if (!res.ok) setLocalOrderedIds(orderedIds);
    } catch {
      setLocalOrderedIds(orderedIds);
    }
  }, [allBlocks, blocks, groupKey, orderedIds, isAdmin]);

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
          Нет участников
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Добавьте пользователей нужного состава в разделе{" "}
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
        items={blocks.map((block) => block.user.id)}
        strategy={rectSortingStrategy}
      >
        <div
          className="p-6 grid gap-5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            alignItems: "start",
          }}
        >
          {blocks.map((block) => (
            /*
              ИСПРАВЛЕНИЕ 3: убираем motion.div-обёртку со stagger-задержкой.
              delay: idx * 0.05 на 20+ блоках = блок анимации ~1с,
              которая конкурирует с обработчиком скролла.

              Вместо этого: whileInView анимирует только при появлении
              в viewport — не трогает уже отрендеренные блоки при скролле.
            */
            <motion.div
              key={block.user.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -40px 0px" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <SortableUserBlock
                block={block}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                isDragEnabled={isAdmin}
              />
            </motion.div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
