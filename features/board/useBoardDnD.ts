"use client";
// useBoardDnD.ts - features/board/hooks
import { useState, useCallback, useRef } from "react";
import { useTaskStore } from "@/shared/store/useTaskStore";
import type { TaskStatus } from "@/shared/types";

export interface DragState {
  draggingId: number | null;
  overStatus: TaskStatus | null;
}

export function useBoardDnD() {
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
  const [dragState, setDragState] = useState<DragState>({ draggingId: null, overStatus: null });
  const draggingIdRef = useRef<number | null>(null);

  const getDragProps = useCallback(
    (taskId: number) => ({
      draggable: true as const,
      "data-dragging": dragState.draggingId === taskId,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(taskId));
        setTimeout(() => {
          draggingIdRef.current = taskId;
          setDragState({ draggingId: taskId, overStatus: null });
        }, 0);
      },
      onDragEnd: () => {
        draggingIdRef.current = null;
        setDragState({ draggingId: null, overStatus: null });
      },
    }),
    [dragState.draggingId]
  );

  const getDropProps = useCallback(
    (status: TaskStatus) => ({
      "data-drop-active": dragState.overStatus === status && dragState.draggingId !== null,
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragState.overStatus !== status) {
          setDragState((s) => ({ ...s, overStatus: status }));
        }
      },
      onDragLeave: () => setDragState((s) => ({ ...s, overStatus: null })),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const taskId = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (!isNaN(taskId)) updateTaskStatus(taskId, status);
        setDragState({ draggingId: null, overStatus: null });
        draggingIdRef.current = null;
      },
    }),
    [dragState.draggingId, dragState.overStatus, updateTaskStatus]
  );

  return { getDragProps, getDropProps, dragState };
}