"use client";
/**
 * @file OfflineBanner.tsx — shared/ui
 *
 * РЕФАКТОРИНГ v3 — Read-only режим:
 *
 *   БЫЛО: баннер обещал синхронизацию изменений при восстановлении.
 *
 *   СТАЛО: офлайн = только просмотр.
 *     - При offline → фиксированное сообщение «Только просмотр»
 *     - При online но очередь не пуста → «Синхронизация...»
 *       (очередь может появиться от кратковременной ошибки сети, не от явного офлайна)
 *     - При online + нет очереди → баннер скрыт
 *
 * SSR-safe: useSyncExternalStore с serverSnapshot = false.
 * Стабильные ссылки subscribe/getSnapshot на уровне модуля.
 */

import { useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";

// ── External store subscriptions ─────────────────────────────────────────────

function subscribe(callback: () => void): () => void {
  window.addEventListener("online",  callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online",  callback);
    window.removeEventListener("offline", callback);
  };
}

const getSnapshot       = () => !navigator.onLine;
const getServerSnapshot = () => false;

// ── Component ─────────────────────────────────────────────────────────────────

export function OfflineBanner() {
  const offline          = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const offlineQueueSize = useTaskStore((s) => s.offlineQueueSize);

  // Show when: explicitly offline, OR online but queue is draining
  const visible = offline || offlineQueueSize > 0;

  const isReadOnly = offline;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="offline-banner"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -40, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2.5 py-1.5 text-xs font-medium"
          style={{
            background:     isReadOnly
              ? "rgba(234,179,8,0.15)"
              : "rgba(56,189,248,0.12)",
            borderBottom:   `1px solid ${isReadOnly ? "rgba(234,179,8,0.3)" : "rgba(56,189,248,0.25)"}`,
            color:          isReadOnly ? "#eab308" : "#38bdf8",
            backdropFilter: "blur(8px)",
          }}
        >
          {isReadOnly ? (
            <>
              {/* Lock icon */}
              <svg
                className="w-3.5 h-3.5 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <rect x="3" y="7" width="10" height="8" rx="2" />
                <path d="M5 7V5a3 3 0 0 1 6 0v2" />
              </svg>

              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-yellow-400 animate-pulse" />

              <span>
                <span className="font-semibold">Офлайн — только просмотр.</span>
                {" "}Изменения недоступны до восстановления соединения.
              </span>
            </>
          ) : (
            <>
              {/* Spinner icon */}
              <svg
                className="w-3.5 h-3.5 shrink-0 animate-spin"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M8 2a6 6 0 0 1 6 6" />
                <circle cx="8" cy="8" r="6" stroke="rgba(56,189,248,0.25)" />
              </svg>

              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-sky-400 animate-pulse" />

              <span>
                Синхронизация:{" "}
                <motion.span
                  key={offlineQueueSize}
                  initial={{ scale: 1.3, opacity: 0.5 }}
                  animate={{ scale: 1,   opacity: 1 }}
                  className="font-bold"
                >
                  {offlineQueueSize}
                </motion.span>
                {" "}изм.
              </span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}