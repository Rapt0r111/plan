"use client";
/**
 * @file SyncOrchestrator.tsx — shared/store
 *
 * ИСПРАВЛЕНИЯ v3:
 *
 * БАГ #5 ИСПРАВЛЕН: уведомление о dropped-операциях (4xx при replay)
 *   БЫЛО: replayOfflineQueue возвращал только successCount.
 *         Если задача была удалена другим пользователем пока текущий был офлайн,
 *         его изменение молча выбрасывалось — никакого уведомления.
 *   СТАЛО: возвращает { successCount, droppedCount }.
 *         При droppedCount > 0 показываем отдельное предупреждение через DynamicIsland.
 *
 * Также: различаем случай "частичного успеха" (successCount > 0 && droppedCount > 0)
 * от "полного успеха" (successCount > 0 && droppedCount === 0).
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTaskStore } from "./useTaskStore";
import { useNotificationStore } from "@/features/sync/useNotificationStore";

export function SyncOrchestrator() {
  const router              = useRouter();
  const refreshOfflineQueue = useTaskStore((s) => s.refreshOfflineQueue);
  const replayOfflineQueue  = useTaskStore((s) => s.replayOfflineQueue);
  const push                = useNotificationStore((s) => s.push);

  const replayingRef = useRef(false);

  useEffect(() => {
    // ── 1. Восстановить счётчик из IDB при монтировании ───────────────────
    refreshOfflineQueue();

    // ── 2. Обработчик восстановления сети ─────────────────────────────────
    const onOnline = async () => {
      if (replayingRef.current) return;
      replayingRef.current = true;

      try {
        const { successCount, droppedCount } = await replayOfflineQueue();

        if (successCount > 0) {
          // Перезагружаем серверные данные
          router.refresh();

          // Уведомление об успешной синхронизации
          push({
            kind:  "sync",
            title: `Синхронизировано: ${successCount} ${pluralizeOps(successCount)}`,
            body:  droppedCount > 0
              ? `${droppedCount} ${pluralizeOps(droppedCount)} устарели и были отброшены`
              : "Офлайн-изменения успешно отправлены на сервер",
            icon:  droppedCount > 0 ? "⚠" : "✓",
          });
        } else if (droppedCount > 0) {
          // БАГ #5: всё упало с 4xx или превысило MAX_OP_RETRIES — нет ни одного успеха
          router.refresh(); // обновляем данные с сервера чтобы отразить актуальное состояние
          push({
            kind:  "error",
            title: "Изменения устарели",
            body:  `${droppedCount} ${pluralizeOps(droppedCount)} не удалось синхронизировать — данные обновлены с сервера`,
            icon:  "⚠",
          });
        }
        // Если successCount === 0 && droppedCount === 0 — очередь была пуста или
        // все операции всё ещё ждут повторов (5xx) — ничего не показываем
      } finally {
        replayingRef.current = false;
      }
    };

    // ── 3. Обработчик потери сети ─────────────────────────────────────────
    const onOffline = () => {
      refreshOfflineQueue();
    };

    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshOfflineQueue, replayOfflineQueue, push, router]);

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pluralizeOps(n: number): string {
  if (n === 1) return "операция";
  if (n >= 2 && n <= 4) return "операции";
  return "операций";
}