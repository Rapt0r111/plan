"use client";
/**
 * @file OfflineBanner.tsx — shared/ui
 *
 * Жёлтый баннер поверх всего приложения, когда браузер теряет сеть.
 * Исчезает сам при восстановлении соединения.
 *
 * РЕАЛИЗАЦИЯ: useSyncExternalStore — правильный React-примитив для подписки
 * на внешние источники данных (browser events, stores, и т.д.).
 *
 *  • subscribe      — регистрирует обработчики online/offline
 *  • getSnapshot    — читает navigator.onLine на клиенте
 *  • getServerSnap  — сервер всегда "онлайн" (нет расхождения при гидрации)
 *
 * Решает три проблемы одновременно:
 *  ✓ Нет hydration mismatch (разные снапшоты для SSR и клиента)
 *  ✓ Нет setState внутри useEffect (react-hooks/set-state-in-effect)
 *  ✓ Нет useEffect вообще — React сам управляет подпиской
 */
import { useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── External store helpers (module-level = стабильные ссылки, не пересоздаются) ──

function subscribe(callback: () => void): () => void {
  window.addEventListener("online",  callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online",  callback);
    window.removeEventListener("offline", callback);
  };
}

const getSnapshot       = () => !navigator.onLine;
const getServerSnapshot = () => false; // сервер не знает о сети — считаем онлайн

// ── Component ─────────────────────────────────────────────────────────────────

export function OfflineBanner() {
  const offline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -40, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-1.5 text-xs font-medium"
          style={{
            background:     "rgba(234,179,8,0.15)",
            borderBottom:   "1px solid rgba(234,179,8,0.3)",
            color:          "#eab308",
            backdropFilter: "blur(8px)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Офлайн-режим — изменения синхронизируются при восстановлении соединения
        </motion.div>
      )}
    </AnimatePresence>
  );
}