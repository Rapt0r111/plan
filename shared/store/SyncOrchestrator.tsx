"use client";
/**
 * @file SyncOrchestrator.tsx — shared/store
 *
 * Монтируется ОДИН РАЗ в app/(main)/layout.tsx.
 * Нет DOM-вывода — только side-effects.
 *
 * ОТВЕТСТВЕННОСТИ:
 *
 * 1. При монтировании — читает IDB и восстанавливает offlineQueueSize
 *    (на случай если пользователь работал офлайн в прошлой сессии
 *    и очередь не была отправлена).
 *
 * 2. При событии "online" — запускает replayOfflineQueue():
 *    - Итерирует PendingOp из IDB по порядку createdAt
 *    - Каждую успешную операцию удаляет из IDB, уменьшает offlineQueueSize
 *    - При ошибке 4xx — удаляет устаревшую операцию
 *    - При ошибке 5xx / network — прерывает, оставляет в очереди
 *    - Вызывает router.refresh() — перегружает серверные данные
 *    - Показывает DynamicIsland-уведомление о результате
 *
 * 3. При событии "offline" — обновляет счётчик (на случай новых операций
 *    которые были добавлены в очередь в прошлой сессии).
 *
 * ПОЧЕМУ НЕ useEffect в SyncNotificationBridge:
 *   Bridge уже занят мониторингом syncStatus.
 *   Смешивать online/offline логику туда создаёт god-component.
 *   SyncOrchestrator — единственная точка ответственности за replay.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTaskStore } from "./useTaskStore";
import { useNotificationStore } from "@/features/sync/useNotificationStore";

export function SyncOrchestrator() {
  const router             = useRouter();
  const refreshOfflineQueue = useTaskStore((s) => s.refreshOfflineQueue);
  const replayOfflineQueue  = useTaskStore((s) => s.replayOfflineQueue);
  const push               = useNotificationStore((s) => s.push);

  // Флаг чтобы не запускать два replay одновременно
  const replayingRef = useRef(false);

  useEffect(() => {
    // ── 1. Восстановить счётчик из IDB при монтировании ───────────────────
    refreshOfflineQueue();

    // ── 2. Обработчик восстановления сети ─────────────────────────────────
    const onOnline = async () => {
      if (replayingRef.current) return;
      replayingRef.current = true;

      try {
        const successCount = await replayOfflineQueue();

        if (successCount > 0) {
          // Перезагружаем серверные данные (invalidate Next.js cache)
          router.refresh();

          // Уведомление через DynamicIsland
          push({
            kind:  "sync",
            title: `Синхронизировано: ${successCount} ${pluralizeOps(successCount)}`,
            body:  "Офлайн-изменения успешно отправлены на сервер",
            icon:  "✓",
          });
        }
      } finally {
        replayingRef.current = false;
      }
    };

    // ── 3. Обработчик потери сети ─────────────────────────────────────────
    const onOffline = () => {
      // Обновляем счётчик — вдруг другая вкладка добавила в очередь
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