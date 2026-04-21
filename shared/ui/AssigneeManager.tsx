"use client";
/**
 * @file AssigneeManager.tsx — shared/ui (извлечён из TasksTab.tsx)
 *
 * Менеджер исполнителей задачи с оптимистичными обновлениями через Zustand store.
 *
 * ПРОБЛЕМА ДО РЕФАКТОРИНГА (в TasksTab.tsx):
 *   const add = async (user: UserWithMeta) => {
 *     setAdding(false);
 *     await fetch(`/api/tasks/${taskId}/assignees`, { ... });
 *     // Note: optimistic update handled at parent level via page reload or store
 *     // For simplicity we just reload; production would use optimistic state
 *   };
 *
 *   Комментарий сам признавал проблему. После fetch UI не обновлялся.
 *
 * ИСПРАВЛЕНИЕ:
 *   - add() теперь вызывает store.addAssignee() — он делает оптимистичный
 *     setState + fetch + rollback при ошибке
 *   - remove() аналогично через store.removeAssignee()
 *   - Нет прямых fetch вызовов в UI-компоненте
 *
 * ПРИМЕЧАНИЕ: Компонент вынесен отдельно чтобы его можно было использовать
 * и в TasksTab, и в других местах (TaskSlideover, QuickAddTask).
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { TaskView, UserWithMeta } from "@/shared/types";

interface Props {
  taskId: number;
  assignees: TaskView["assignees"];
  users: UserWithMeta[];
}

export function AssigneeManager({ taskId, assignees, users }: Props) {
  const [adding, setAdding] = useState(false);
  const addAssignee = useTaskStore((s) => s.addAssignee);
  const removeAssignee = useTaskStore((s) => s.removeAssignee);

  const assignedIds = new Set(assignees.map((a) => a.id));
  const available = users.filter((u) => !assignedIds.has(u.id));

  // ИСПРАВЛЕНО: используем store.addAssignee вместо прямого fetch
  // addAssignee делает: оптимистичный setState → fetch → rollback при ошибке
  const handleAdd = async (user: UserWithMeta) => {
    setAdding(false);
    // Вместо ручного перечисления полей передаем весь объект user
    await addAssignee(taskId, user);
  };

  // ИСПРАВЛЕНО: используем store.removeAssignee вместо прямого fetch
  const handleRemove = async (userId: number) => {
    await removeAssignee(taskId, userId);
  };

  return (
    <div className="space-y-1.5">
      {/* Current assignees */}
      {assignees.map((a) => (
        <div key={a.id} className="flex items-center gap-2 group/a">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ backgroundColor: a.roleMeta.hex }}
          >
            {a.initials}
          </div>
          <span className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
            {a.name}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: `${a.roleMeta.hex}18`, color: a.roleMeta.hex }}
          >
            {a.roleMeta.short}
          </span>
          <button
            onClick={() => handleRemove(a.id)}
            className="opacity-0 group-hover/a:opacity-100 w-4 h-4 rounded flex items-center justify-center transition-all"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l6 6M8 2L2 8" />
            </svg>
          </button>
        </div>
      ))}

      {/* Add button + dropdown */}
      {available.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setAdding((v) => !v)}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)", border: "1px dashed var(--glass-border)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent-400)";
              e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.borderColor = "var(--glass-border)";
            }}
          >
            <span>+</span> Добавить
          </button>

          <AnimatePresence>
            {adding && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full left-0 mb-1 z-30 rounded-xl overflow-hidden shadow-2xl"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)", minWidth: 180 }}
              >
                {available.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleAdd(u)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-(--glass-01) transition-colors text-left"
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: u.roleMeta.hex }}
                    >
                      {u.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {u.name}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                        {u.roleMeta.label}
                      </p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}