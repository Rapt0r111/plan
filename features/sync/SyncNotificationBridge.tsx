"use client";
/**
 * @file SyncNotificationBridge.tsx — features/sync
 *
 * РЕФАКТОРИНГ: перемещён из shared/lib/ в features/sync/
 *
 * ПРИЧИНА:
 *  shared/ по FSD не должен импортировать из widgets/.
 *  SyncNotificationBridge использовал useNotify() из widgets/notifications/DynamicIsland —
 *  это нарушение пирамиды зависимостей (shared → widgets недопустимо).
 *
 * features/ может импортировать из widgets/ — правило соблюдено.
 *
 * ФАЙЛЫ К УДАЛЕНИЮ ПОСЛЕ МИГРАЦИИ:
 *  - shared/lib/SyncNotificationBridge.tsx
 *  - app/providers/SyncNotificationBridge.tsx (дубль)
 *
 * ИМПОРТ В app/layout.tsx:
 *  import { SyncNotificationBridge } from "@/features/sync/SyncNotificationBridge";
 */

import { useEffect, useRef } from "react";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useNotify } from "./DynamicIsland";

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