"use client";
/**
 * @file RealtimeProvider.tsx — shared/store
 *
 * Монтирует SSE-подписку один раз на корневом уровне layout.
 *
 * ПОЧЕМУ CLIENT COMPONENT:
 *   useServerEvents использует useEffect (браузерный API EventSource)
 *   → обязательно "use client".
 *   Но сам провайдер не рендерит никакой UI — pure side-effect mount.
 *
 * ГДЕ МОНТИРОВАТЬ:
 *   app/(main)/layout.tsx — рядом с OfflineHydrator и SyncOrchestrator.
 *   Там же живут все "невидимые" клиентские эффекты.
 *
 * INDICATOR:
 *   Опционально показывает индикатор real-time соединения.
 *   По умолчанию не рендерит ничего.
 */
import { useServerEvents } from "@/shared/hooks/useServerEvents";

interface Props {
  /** Показать пульсирующий индикатор real-time подключения (по умолч. false) */
  showIndicator?: boolean;
}

export function RealtimeProvider({ showIndicator = false }: Props) {
  useServerEvents();

  if (!showIndicator) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full pointer-events-none"
      style={{
        background: "rgba(52,211,153,0.08)",
        border:     "1px solid rgba(52,211,153,0.2)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full bg-emerald-400"
        style={{ animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
      />
      <span className="text-[10px] font-mono" style={{ color: "#34d399" }}>
        live
      </span>
    </div>
  );
}