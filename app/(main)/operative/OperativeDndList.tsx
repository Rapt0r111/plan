"use client";

import { useOptimistic, useTransition, useCallback } from "react";
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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { useAction } from "next-safe-action/hooks";
import {
  updateOrderAction,
  deleteOperativeTaskAction,
  updateOperativeTaskAction,
} from "@/entities/operative/operativeActions";
import type { OperativeTaskView } from "@/entities/operative/operativeRepository";

// ── Типы ─────────────────────────────────────────────────────────────────────

interface Props {
  tasks:   OperativeTaskView[];
  isAdmin: boolean;
  userId:  number;
}

// ── Отдельная карточка с DnD-хуком ───────────────────────────────────────────

function SortableTaskCard({
  task,
  isAdmin,
  onDelete,
  onStatusChange,
}: {
  task:           OperativeTaskView;
  isAdmin:        boolean;
  onDelete:       (id: number) => void;
  onStatusChange: (id: number, status: OperativeTaskView["status"]) => void;
}) {
  // useSortable даёт нам ref, transform и listeners для конкретного элемента
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id:       task.id,
    disabled: !isAdmin, // DnD доступен только админу
  });

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.4 : 1,
    zIndex:     isDragging ? 50 : undefined,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style}>
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="flex items-center gap-3 px-3.5 py-3 rounded-xl group"
        style={{
          background: "var(--bg-overlay)",
          border:     "1px solid var(--glass-border)",
        }}
      >
        {/* Drag handle — только для администратора */}
        {isAdmin && (
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 w-5 h-5 flex items-center justify-center opacity-30 hover:opacity-70 transition-opacity cursor-grab active:cursor-grabbing"
            aria-label="Перетащить задачу"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 4h.01M6 8h.01M6 12h.01M10 4h.01M10 8h.01M10 12h.01" />
            </svg>
          </button>
        )}

        {/* Контент задачи */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium"
            style={{
              color:          task.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
              textDecoration: task.status === "done" ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>
          {task.dueDate && (
            <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
              {new Date(task.dueDate).toLocaleDateString("ru-RU")}
            </p>
          )}
        </div>

        {/* Статус (кликабелен только для админа) */}
        <button
          onClick={isAdmin
            ? () => onStatusChange(task.id, task.status === "done" ? "todo" : "done")
            : undefined
          }
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: task.status === "done"
              ? "rgba(52,211,153,0.15)"
              : "rgba(100,116,139,0.15)",
            color:  task.status === "done" ? "#34d399" : "#94a3b8",
            cursor: isAdmin ? "pointer" : "default",
          }}
        >
          {task.status === "done" ? "Готово" : "К работе"}
        </button>

        {/* Кнопка удаления — ТОЛЬКО для администратора */}
        {isAdmin && (
          <button
            onClick={() => onDelete(task.id)}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = "#f87171";
              (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" />
            </svg>
          </button>
        )}
      </motion.div>
    </div>
  );
}

// ── Основной компонент со списком ─────────────────────────────────────────────

export function OperativeDndList({ tasks: initialTasks, isAdmin, userId }: Props) {
  const [isPending, startTransition] = useTransition();

  /*
    useOptimistic:
      - первый аргумент: реальное состояние (приходит с сервера)
      - второй аргумент: функция применения оптимистичного обновления
    React 19: при завершении перехода оптимистичное состояние
    заменяется реальным — автоматически.
  */
  const [optimisticTasks, setOptimisticTasks] = useOptimistic(
    initialTasks,
    (
      state:  OperativeTaskView[],
      action:
        | { type: "reorder"; newOrder: OperativeTaskView[] }
        | { type: "delete";  id: number }
        | { type: "status";  id: number; status: OperativeTaskView["status"] }
    ) => {
      switch (action.type) {
        case "reorder": return action.newOrder;
        case "delete":  return state.filter(t => t.id !== action.id);
        case "status":  return state.map(t =>
          t.id === action.id ? { ...t, status: action.status } : t
        );
        default: return state;
      }
    }
  );

  // Подключаем server actions через хук next-safe-action
  const { executeAsync: executeUpdateOrder } = useAction(updateOrderAction);
  const { executeAsync: executeDelete }      = useAction(deleteOperativeTaskAction);
  const { executeAsync: executeStatus }      = useAction(updateOperativeTaskAction);

  // DnD sensors — поддержка мыши и клавиатуры
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ── DnD Handler ─────────────────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = optimisticTasks.findIndex(t => t.id === active.id);
      const newIndex = optimisticTasks.findIndex(t => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(optimisticTasks, oldIndex, newIndex);

      startTransition(async () => {
        // 1. Мгновенно обновляем UI оптимистично
        setOptimisticTasks({ type: "reorder", newOrder: reordered });

        // 2. В фоне обновляем порядок на сервере
        await executeUpdateOrder({
          items: reordered.map((t, i) => ({ id: t.id, order: i })),
        });
      });
    },
    [optimisticTasks, executeUpdateOrder, setOptimisticTasks, startTransition]
  );

  // ── Delete Handler ──────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    (id: number) => {
      startTransition(async () => {
        setOptimisticTasks({ type: "delete", id });
        await executeDelete({ id });
      });
    },
    [executeDelete, setOptimisticTasks, startTransition]
  );

  // ── Status Handler ──────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(
    (id: number, currentStatus: OperativeTaskView["status"]) => {
      const newStatus = currentStatus === "done" ? "todo" : ("done" as const);
      startTransition(async () => {
        setOptimisticTasks({ type: "status", id, status: newStatus });
        await executeStatus({ id, status: newStatus });
      });
    },
    [executeStatus, setOptimisticTasks, startTransition]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={optimisticTasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className="space-y-2"
          style={{ opacity: isPending ? 0.85 : 1, transition: "opacity 0.15s" }}
        >
          <AnimatePresence mode="popLayout">
            {optimisticTasks.map(task => (
              <SortableTaskCard
                key={task.id}
                task={task}
                isAdmin={isAdmin}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </AnimatePresence>

          {optimisticTasks.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
              Нет задач
            </p>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}