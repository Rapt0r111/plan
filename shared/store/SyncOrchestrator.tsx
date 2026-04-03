"use client";
/**
 * @file SyncOrchestrator.tsx — shared/store
 *
 * ИСПРАВЛЕНИЯ v4:
 *
 * БАГ #6 ИСПРАВЛЕН: очередь зависала при непрерывном онлайн-соединении.
 *
 *   ПРОБЛЕМА: replay запускался ТОЛЬКО по событию "online".
 *   Сценарий: пользователь онлайн → кратковременная сетевая ошибка (TypeError)
 *   → операция попадает в IndexedDB-очередь → "online" не стреляет повторно
 *   (браузер уже считается онлайн) → очередь висит вечно, "Синхронизация:
 *   1 изменение..." горит, но изменение исчезает при следующем router.refresh().
 *
 *   РЕШЕНИЕ: при монтировании, если очередь не пуста и пользователь онлайн,
 *   запускаем replayOfflineQueue через 800 мс (после полной инициализации стора).
 *
 * БАГ #5 из v3 сохранён (уведомление о dropped-операциях).
 */

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTaskStore } from "./useTaskStore";
import { useNotificationStore } from "@/features/sync/useNotificationStore";

export function SyncOrchestrator() {
  const router              = useRouter();
  const refreshOfflineQueue = useTaskStore((s) => s.refreshOfflineQueue);
  const replayOfflineQueue  = useTaskStore((s) => s.replayOfflineQueue);
  const push                = useNotificationStore((s) => s.push);
  const replayingRef        = useRef(false);

  // ── Общая логика replay (переиспользуется в монтировании и onOnline) ──────
  const doReplay = useCallback(async () => {
    if (replayingRef.current || !navigator.onLine) return;
    replayingRef.current = true;

    try {
      const { successCount, droppedCount } = await replayOfflineQueue();

      if (successCount > 0) {
        // Перезагружаем серверные данные
        router.refresh();

        push({
          kind:  "sync",
          title: `Синхронизировано: ${successCount} ${pluralizeOps(successCount)}`,
          body:  droppedCount > 0
            ? `${droppedCount} ${pluralizeOps(droppedCount)} устарели и были отброшены`
            : "Офлайн-изменения успешно отправлены на сервер",
          icon:  droppedCount > 0 ? "⚠" : "✓",
        });
      } else if (droppedCount > 0) {
        router.refresh();
        push({
          kind:  "error",
          title: "Изменения устарели",
          body:  `${droppedCount} ${pluralizeOps(droppedCount)} не удалось синхронизировать — данные обновлены с сервера`,
          icon:  "⚠",
        });
      }
    } finally {
      replayingRef.current = false;
    }
  }, [replayOfflineQueue, push, router]);

  useEffect(() => {
    // ── 1. Восстановить счётчик из IDB при монтировании ───────────────────
    refreshOfflineQueue();

    // ── 1b. ИСПРАВЛЕНИЕ: немедленный replay при старте, если есть очередь ──
    //
    // Покрывает сценарий «всегда онлайн, но кратковременная ошибка сети»:
    //   - Пользователь создаёт задачу/эпик
    //   - fetch() бросает TypeError (разрыв соединения на долю секунды)
    //   - isNetworkError() = true → операция в IndexedDB-очередь
    //   - offlineQueueSize = 1, баннер «Синхронизация: 1 изменение...»
    //   - Пользователь остаётся онлайн → событие "online" НЕ стреляет
    //   - Без этого фикса очередь висит до перезагрузки страницы,
    //     а при следующем router.refresh() (SSE-событие) задача исчезает
    //     из-за того, что сервер её не знает
    //
    // 800 мс — достаточно для завершения гидрации стора (hydrateEpics),
    // но быстро с точки зрения UX.
    const mountReplayTimer = setTimeout(async () => {
      // Проверяем актуальное состояние стора (не stale closure)
      const queueSize = useTaskStore.getState().offlineQueueSize;
      if (queueSize > 0) {
        await doReplay();
      }
    }, 800);

    // ── 2. Обработчик восстановления сети ─────────────────────────────────
    const onOnline = () => doReplay();

    // ── 3. Обработчик потери сети ─────────────────────────────────────────
    const onOffline = () => {
      refreshOfflineQueue();
    };

    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      clearTimeout(mountReplayTimer);
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshOfflineQueue, doReplay]);

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pluralizeOps(n: number): string {
  if (n === 1) return "операция";
  if (n >= 2 && n <= 4) return "операции";
  return "операций";
}