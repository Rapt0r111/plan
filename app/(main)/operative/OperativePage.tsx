"use client";
/**
 * @file OperativePage.tsx — app/(main)/operative
 *
 * ИСПРАВЛЕНИЯ v5 — персистентный DnD порядок блоков:
 *
 * ПРОБЛЕМА:
 *   Порядок блоков хранился в локальном useState → после обновления страницы
 *   или у других участников порядок сбрасывался в исходный.
 *
 * РЕШЕНИЕ:
 *   1. `initialData` приходит с сервера уже отсортированным по `users.block_order`
 *      (исправлено в operativeRepository.ts).
 *   2. После DnD вызываем PATCH /api/operative-blocks — сохраняем порядок в БД.
 *   3. Через SSE broadcast другие участники получают событие → router.refresh()
 *      → видят новый порядок без ручного перезагрузки страницы.
 *   4. orderedIds всё ещё используется для оптимистичного UI (мгновенный отклик),
 *      но инициализируется из серверного порядка (block_order из БД).
 *
 * Ключевой инвариант:
 *   - При первой загрузке: порядок = block_order из БД (персистентный)
 *   - При DnD: мгновенный оптимистичный сдвиг + сохранение в БД
 *   - При обновлении страницы: порядок читается из БД → совпадает с тем, что видели
 *   - Другие участники: SSE → refresh → тот же порядок из БД
 */
import { useEffect, useCallback } from "react";
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
  const hydrate    = useOperativeStore((s) => s.hydrate);
  const isHydrated = useOperativeStore((s) => s.isHydrated);
  const userBlocks = useOperativeStore((s) => s.userBlocks);

  useEffect(() => {
    hydrate(initialData);
  }, [initialData, hydrate]);

  const sourceBlocks: UserWithOperativeTasks[] = isHydrated ? userBlocks : initialData;

  /**
   * orderedIds — оптимистичный список ID пользователей в нужном порядке.
   *
   * Инициализируется из `sourceBlocks`, который приходит с сервера
   * уже отсортированным по `block_order` (исправлено в operativeRepository).
   * После DnD обновляется локально (мгновенный отклик) + сохраняется в БД.
   * При следующем рендере (refresh/SSE) `initialData` снова приходит
   * в правильном порядке из БД → orderedIds переинициализируется корректно.
   */
  const [orderedIds, setOrderedIds] = useState<number[]>(() =>
    sourceBlocks.map((b) => b.user.id)
  );

  // Sync: если появились новые пользователи (SSE + hydrate), добавляем в конец
  const currentIds  = sourceBlocks.map((b) => b.user.id);
  const existingSet = new Set(orderedIds);
  const toAdd       = currentIds.filter((id) => !existingSet.has(id));
  if (toAdd.length > 0) {
    setOrderedIds((prev) => [...prev, ...toAdd]);
  }

  // Sync: если initialData пришёл с новым server-порядком (после refresh/SSE),
  // синхронизируем orderedIds — это нужно чтобы видеть порядок, сохранённый
  // другим администратором
  useEffect(() => {
    const serverIds = initialData.map((b) => b.user.id);
    // Проверяем, изменился ли server-порядок относительно текущего local
    const serverKey = serverIds.join(",");
    setOrderedIds((prev) => {
      const prevKey = prev.join(",");
      if (prevKey === serverKey) return prev; // уже совпадают
      // Применяем server-порядок, добавляя новые userId в конец
      const prevSet = new Set(prev);
      const merged  = [...serverIds, ...prev.filter(id => !new Set(serverIds).has(id))];
      return merged;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  // Собираем блоки в правильном порядке
  const blocks = orderedIds
    .map((id) => sourceBlocks.find((b) => b.user.id === id))
    .filter(Boolean) as UserWithOperativeTasks[];

  // ── DnD sensors ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = orderedIds.indexOf(Number(active.id));
    const newIdx = orderedIds.indexOf(Number(over.id));
    if (oldIdx === -1 || newIdx === -1) return;

    const newOrderedIds = arrayMove(orderedIds, oldIdx, newIdx);

    // 1. Оптимистично обновляем UI (мгновенно)
    setOrderedIds(newOrderedIds);

    // 2. Сохраняем в БД — только администратор может менять порядок
    //    (API также проверяет сессию через requireAdminSession)
    if (!isAdmin) return;

    try {
      const res = await fetch("/api/operative-blocks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: newOrderedIds.map((id, i) => ({ id, blockOrder: i })),
        }),
      });

      if (!res.ok) {
        // При ошибке возвращаем прежний порядок
        setOrderedIds(orderedIds);
      }
      // Успех → broadcast через SSE → другие участники увидят новый порядок
    } catch {
      // Сетевая ошибка — откатываем оптимистичный сдвиг
      setOrderedIds(orderedIds);
    }
  }, [orderedIds, isAdmin]);

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