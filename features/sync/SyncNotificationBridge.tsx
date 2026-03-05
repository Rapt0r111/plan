"use client";
import { useEffect, useRef } from "react";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useNotificationStore } from "./useNotificationStore";

export function SyncNotificationBridge() {
  const push       = useNotificationStore((s) => s.push);
  const syncStatus = useTaskStore((s) => s.syncStatus);
  const prevStatus = useRef(syncStatus);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = syncStatus;

    if (prev !== "error" && syncStatus === "error") {
      push({
        kind:  "error",
        title: "Ошибка синхронизации",
        body:  "Изменения не сохранены. Повтор...",
      });
    }
    // syncing → synced: без уведомления (notification fatigue)
  }, [syncStatus, push]);

  return null;
}