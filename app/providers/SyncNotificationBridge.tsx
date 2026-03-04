"use client";
/**
 * @file SyncNotificationBridge.tsx — app/providers
 *
 * Слушает syncStatus из useTaskStore и пушит нотификации в DynamicIsland.
 *
 * Паттерн: Observer на Zustand store через subscribeWithSelector.
 * Нулевая рендер-нагрузка — компонент не рендерит DOM-элементы.
 */

import { useEffect, useRef } from "react";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useNotify } from "@/widgets/notifications/DynamicIsland";

export function SyncNotificationBridge() {
  const notify = useNotify();
  const syncStatus = useTaskStore((s) => s.syncStatus);
  const prevStatus = useRef(syncStatus);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = syncStatus;

    // error → уведомляем
    if (prev !== "error" && syncStatus === "error") {
      notify({
        type: "sync_error",
        title: "Ошибка синхронизации",
        body: "Изменения не сохранены. Повтор...",
        duration: 4000,
      });
      return;
    }

    // syncing → synced: тихо, без нотификации (не беспокоим по пустякам)
    // Добавлять нотификацию "SYNCED" — антипаттерн (notification fatigue)
  }, [syncStatus, notify]);

  return null;
}