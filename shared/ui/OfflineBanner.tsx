"use client";
/**
 * @file OfflineBanner.tsx — shared/ui
 *
 * ИСПРАВЛЕНИЯ v2:
 *
 * 1. УБРАНА ЛОЖЬ:
 *    БЫЛО: "изменения синхронизируются при восстановлении соединения"
 *          (механизма синхронизации не существовало — чистый обман)
 *    СТАЛО: честный текст, зависящий от реального состояния:
 *      - Офлайн, нет очереди → "Офлайн — новые изменения недоступны"
 *      - Офлайн, есть очередь → "Офлайн — N изменений ожидают отправки"
 *      - Онлайн, очередь ещё отправляется → "Синхронизация: N изменений..."
 *
 * 2. ПОКАЗЫВАЕМ СТАТУС ОЧЕРЕДИ:
 *    Читаем offlineQueueSize из useTaskStore. Баннер остаётся видимым
 *    пока очередь не опустеет (даже если сеть уже восстановлена).
 *
 * 3. АНИМАЦИЯ СЧЁТЧИКА:
 *    При уменьшении очереди (replay) счётчик анимируется — пользователь
 *    видит прогресс синхронизации.
 *
 * АРХИТЕКТУРА:
 *   - useSyncExternalStore для navigator.onLine — без useEffect,
 *     без hydration mismatch (serverSnapshot = false)
 *   - useTaskStore для offlineQueueSize
 *   - Баннер показывается если offline || offlineQueueSize > 0
 */

import { useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/shared/store/useTaskStore";

// ── External store subscriptions (module-level = стабильные ссылки) ──────────

function subscribe(callback: () => void): () => void {
  window.addEventListener("online",  callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online",  callback);
    window.removeEventListener("offline", callback);
  };
}

const getSnapshot       = () => !navigator.onLine;
const getServerSnapshot = () => false; // SSR: считаем что онлайн

// ── Helpers ───────────────────────────────────────────────────────────────────

function pluralizeChanges(n: number): string {
  if (n === 1) return "изменение";
  if (n >= 2 && n <= 4) return "изменения";
  return "изменений";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OfflineBanner() {
  const offline         = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const offlineQueueSize = useTaskStore((s) => s.offlineQueueSize);

  const hasQueue = offlineQueueSize > 0;

  // Показываем баннер если:
  //   - офлайн (независимо от очереди)
  //   - онлайн но очередь ещё отправляется (replay в процессе)
  const visible = offline || hasQueue;

  // ── Определяем текст и цвет в зависимости от состояния ──────────────────
  const variant = offline
    ? (hasQueue ? "offline-queued" : "offline-clean")
    : "syncing";

  const variants = {
    "offline-queued": {
      bg:     "rgba(234,179,8,0.15)",
      border: "rgba(234,179,8,0.3)",
      text:   "#eab308",
      dot:    "bg-yellow-400",
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 2v6l4 2" /><circle cx="8" cy="8" r="6" />
        </svg>
      ),
      label: `Офлайн — ${offlineQueueSize} ${pluralizeChanges(offlineQueueSize)} ожидают отправки`,
    },
    "offline-clean": {
      bg:     "rgba(234,179,8,0.12)",
      border: "rgba(234,179,8,0.25)",
      text:   "#eab308",
      dot:    "bg-yellow-400",
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 4h14M1 8h10M1 12h6" />
        </svg>
      ),
      label: "Офлайн — просмотр доступен, изменения будут заблокированы",
    },
    "syncing": {
      bg:     "rgba(56,189,248,0.12)",
      border: "rgba(56,189,248,0.25)",
      text:   "#38bdf8",
      dot:    "bg-sky-400",
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0 animate-spin" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 2a6 6 0 0 1 6 6" /><circle cx="8" cy="8" r="6" stroke="rgba(56,189,248,0.25)" />
        </svg>
      ),
      label: `Синхронизация: ${offlineQueueSize} ${pluralizeChanges(offlineQueueSize)}...`,
    },
  } as const;

  const cfg = variants[variant];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="offline-banner"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -40, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 left-0 right-0 z-9999 flex items-center justify-center gap-2.5 py-1.5 text-xs font-medium"
          style={{
            background:     cfg.bg,
            borderBottom:   `1px solid ${cfg.border}`,
            color:          cfg.text,
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Статус-точка */}
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot} animate-pulse`} />

          {/* Иконка */}
          {cfg.icon}

          {/* Текст */}
          <span>{cfg.label}</span>

          {/* Счётчик с анимацией при изменении */}
          {hasQueue && (
            <motion.span
              key={offlineQueueSize}
              initial={{ scale: 1.3, opacity: 0.5 }}
              animate={{ scale: 1,   opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="font-mono font-bold px-1.5 py-0.5 rounded-md"
              style={{
                background: `${cfg.text}18`,
                border:     `1px solid ${cfg.text}30`,
              }}
            >
              {offlineQueueSize}
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}