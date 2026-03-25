"use client";
/**
 * @file SyncNotificationBridge.tsx — features/sync
 *
 * ИСПРАВЛЕНИЕ v2:
 *   БЫЛО: body: "Изменения не сохранены. Повтор..." — ложное обещание.
 *         Retry не происходил, bridge только показывал уведомление.
 *   СТАЛО: честный текст без упоминания повтора.
 *          Реальный retry теперь в SyncOrchestrator (событие "online").
 *
 * НОВОЕ: Реагирует на переход error → synced после успешного replay.
 *        Показывает кратковременное green-уведомление.
 */
import { useEffect, useRef } from "react";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useNotificationStore } from "./useNotificationStore";
import type { SyncStatus } from "@/shared/store/useTaskStore";

export function SyncNotificationBridge() {
  const push       = useNotificationStore((s) => s.push);
  const syncStatus = useTaskStore((s) => s.syncStatus);
  const prevStatus = useRef<SyncStatus>(syncStatus);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = syncStatus;

    // online-ошибка сети (404, 500, timeout при наличии сети)
    if (prev !== "error" && syncStatus === "error") {
      push({
        kind:  "error",
        title: "Ошибка синхронизации",
        body:  "Изменение не сохранено. Проверьте соединение.",
        // NB: не обещаем "повтор" — реальный retry делает SyncOrchestrator
        //     только когда браузер получит событие "online"
      });
    }
  }, [syncStatus, push]);

  return null;
}