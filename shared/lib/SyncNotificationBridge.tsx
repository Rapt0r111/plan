"use client";
/**
 * @file SyncNotificationBridge.tsx — shared/lib
 *
 * Observer: слушает syncStatus из useTaskStore,
 * пушит нотификации об ошибках в DynamicIsland.
 *
 * Размещён в shared/lib (не в app/providers) потому что:
 *  — Это утилита без UI, не провайдер
 *  — Зависит от shared/store и widgets/notifications — оба ниже по FSD
 *  — Монтируется в app/layout.tsx напрямую
 *
 * Нулевая DOM-нагрузка — возвращает null.
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

    if (prev !== "error" && syncStatus === "error") {
      notify({
        type: "sync_error",
        title: "Ошибка синхронизации",
        body: "Изменения не сохранены. Повтор...",
        duration: 4000,
      });
    }

    // syncing → synced: намеренно без нотификации
    // Notification fatigue: пользователь не должен видеть «OK» после каждого клика
  }, [syncStatus, notify]);

  return null;
}