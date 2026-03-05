"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useZenStore } from "../useZenStore";
import { useTaskStore } from "@/shared/store/useTaskStore";

export function useZenSession() {
  const {
    isActive,
    currentTask,
    taskQueue,
    sessionStats,
    deactivate,
    markCompleted,
    nextTask,
  } = useZenStore();

  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive || !sessionStats.startedAt) {
      return;
    }

    const startedAt = sessionStats.startedAt.getTime();

    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startedAt) / 60000);
      setElapsed(diff);
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [isActive, sessionStats.startedAt]);

  const handleComplete = useCallback(async () => {
    if (!currentTask) return;
    await updateTaskStatus(currentTask.id, "done");
    markCompleted();
  }, [currentTask, markCompleted, updateTaskStatus]);

  const queueLeft = useMemo(() => {
    if (!currentTask) return 0;
    const idx = taskQueue.findIndex((t) => t.id === currentTask.id);
    return idx === -1 ? 0 : taskQueue.length - idx;
  }, [taskQueue, currentTask]);

  return {
    isActive,
    currentTask,
    sessionStats,
    deactivate,
    nextTask,
    handleComplete,
    queueLeft,
    elapsed,
  };
}