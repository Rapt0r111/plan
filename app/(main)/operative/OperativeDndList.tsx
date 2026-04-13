"use client";
/**
 * @file OperativeDndList.tsx — app/(main)/operative
 *
 * v2 — Role-based access:
 *   - Admin: full DnD reorder, status cycle (todo/in_progress/done), delete
 *   - Guest/member: only toggle done ↔ not-done via /api/operative-tasks/:id/status
 *     The guest toggle maps any current status → "done" or "todo".
 *     No drag, no delete, no date editing for guests.
 *
 * DnD reorder uses /api/operative-tasks/:id (PATCH sortOrder) which is admin-only.
 */
import { useOptimistic, useTransition, useCallback, useState } from "react";
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  tasks:   OperativeTaskView[];
  isAdmin: boolean;
  userId:  number;
}

// ── Sortable task card ────────────────────────────────────────────────────────

function SortableTaskCard({
  task,
  isAdmin,
  onDelete,
  onStatusChange,
  onGuestToggle,
}: {
  task:           OperativeTaskView;
  isAdmin:        boolean;
  onDelete:       (id: number) => void;
  onStatusChange: (id: number, status: OperativeTaskView["status"]) => void;
  onGuestToggle:  (id: number, currentDone: boolean) => void;
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({
    id:       task.id,
    disabled: !isAdmin,
  });

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.4 : 1,
    zIndex:     isDragging ? 50 : undefined,
  };

  const isDone = task.status === "done";

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
        {/* Drag handle — admin only */}
        {isAdmin && (
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 w-5 h-5 flex items-center justify-center opacity-30 hover:opacity-70 transition-opacity cursor-grab active:cursor-grabbing"
            aria-label="Перетащить задачу"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 4h.01M6 8h.01M6 12h.01M10 4h.01M10 8h.01M10 12h.01" />
            </svg>
          </button>
        )}

        {/* ── Guest done checkbox (always visible for all) ── */}
        {!isAdmin && (
          <button
            onClick={() => onGuestToggle(task.id, isDone)}
            className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center border transition-all"
            style={{
              background:   isDone ? "#34d399" : "transparent",
              borderColor:  isDone ? "#34d399" : "var(--glass-border-active)",
              boxShadow:    isDone ? "0 0 8px rgba(52,211,153,0.5)" : "none",
            }}
            title={isDone ? "Отметить как не готово" : "Отметить как готово"}
          >
            {isDone && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M1.5 5l2.5 2.5 4.5-4.5" />
              </svg>
            )}
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium"
            style={{
              color:          isDone ? "var(--text-muted)" : "var(--text-primary)",
              textDecoration: isDone ? "line-through" : "none",
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
          onClick={() => onStatusChange(task.id, task.status === "done" ? "todo" : "done")}
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: task.status === "done"
              ? "rgba(52,211,153,0.15)"
              : "rgba(100,116,139,0.15)",
            color:  task.status === "done" ? "#34d399" : "#94a3b8",
            cursor: "pointer",
          }}
        >
          {task.status === "done" ? "Готово" : "К работе"}
        </button>

        {/* Delete — admin only */}
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
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" />
            </svg>
          </button>
        )}
      </motion.div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OperativeDndList({ tasks: initialTasks, isAdmin, userId: _userId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [guestError, setGuestError]  = useState<string | null>(null);

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

  const { executeAsync: executeUpdateOrder } = useAction(updateOrderAction);
  const { executeAsync: executeDelete }      = useAction(deleteOperativeTaskAction);
  const { executeAsync: executeStatus }      = useAction(updateOperativeTaskAction);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Admin: DnD reorder ────────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!isAdmin) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = optimisticTasks.findIndex(t => t.id === active.id);
      const newIndex = optimisticTasks.findIndex(t => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(optimisticTasks, oldIndex, newIndex);

      startTransition(async () => {
        setOptimisticTasks({ type: "reorder", newOrder: reordered });
        await executeUpdateOrder({
          items: reordered.map((t, i) => ({ id: t.id, order: i })),
        });
      });
    },
    [optimisticTasks, executeUpdateOrder, setOptimisticTasks, isAdmin, startTransition]
  );

  // ── Admin: delete ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    (id: number) => {
      if (!isAdmin) return;
      startTransition(async () => {
        setOptimisticTasks({ type: "delete", id });
        await executeDelete({ id });
      });
    },
    [executeDelete, setOptimisticTasks, isAdmin, startTransition]
  );

  // ── Admin: full status change ─────────────────────────────────────────────
  const handleStatusChange = useCallback(
    (id: number, currentStatus: OperativeTaskView["status"]) => {
      if (!isAdmin) return;
      const newStatus = currentStatus === "done" ? "todo" : ("done" as const);
      startTransition(async () => {
        setOptimisticTasks({ type: "status", id, status: newStatus });
        await executeStatus({ id, status: newStatus });
      });
    },
    [executeStatus, setOptimisticTasks, isAdmin, startTransition]
  );

  // ── Guest: done ↔ not-done toggle ─────────────────────────────────────────
  const handleGuestToggle = useCallback(
    (id: number, currentDone: boolean) => {
      if (isAdmin) return; // admin uses handleStatusChange instead
      setGuestError(null);
      const newStatus: OperativeTaskView["status"] = currentDone ? "todo" : "done";

      startTransition(async () => {
        setOptimisticTasks({ type: "status", id, status: newStatus });
        const res = await fetch(`/api/operative-tasks/${id}/status`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ done: !currentDone }),
        });
        if (!res.ok) {
          // Rollback optimistic update
          setOptimisticTasks({ type: "status", id, status: currentDone ? "done" : "todo" });
          setGuestError("Не удалось изменить статус. Попробуйте ещё раз.");
        }
      });
    },
    [isAdmin, setOptimisticTasks, startTransition]
  );

  return (
    <div className="space-y-2">
      {/* Guest error */}
      <AnimatePresence>
        {guestError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-3 py-2 rounded-xl text-xs"
            style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
          >
            {guestError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role hint for guests */}
      {!isAdmin && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="7" cy="5" r="2.5" /><path d="M1.5 13a5.5 5.5 0 0 1 11 0" />
          </svg>
          Вы можете отметить задачи как выполненные. Полное управление доступно администратору.
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={optimisticTasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ opacity: isPending ? 0.85 : 1, transition: "opacity 0.15s" }}>
            <AnimatePresence mode="popLayout">
              {optimisticTasks.map(task => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  isAdmin={isAdmin}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  onGuestToggle={handleGuestToggle}
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
    </div>
  );
}
