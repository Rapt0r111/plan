"use client";
/**
 * @file AppProviders.tsx — app/providers
 *
 * Глобальный слой провайдеров и постоянных UI-слоёв.
 *
 * ЧТО ЗДЕСЬ МОНТИРУЕТСЯ:
 *  1. ZenMode      — fixed overlay, z-[9999], поверх всего
 *  2. DynamicIsland — fixed top-center, z-[9998]
 *
 * ЧТО НЕ ЗДЕСЬ:
 *  CommandPalette уже монтируется в app/layout.tsx (z-50).
 *  Добавлять новые глобальные компоненты нужно только сюда.
 *
 * ПОРЯДОК Z-INDEX:
 *  CommandPalette (z-50) < DynamicIsland (z-9998) < ZenMode (z-9999)
 *  ZenMode всегда поверх всего — это принципиально важно для фокуса.
 */

import { ZenMode } from "@/features/zen-mode/ZenMode";
import { DynamicIsland } from "@/widgets/notifications/DynamicIsland";
import { SyncNotificationBridge } from "./SyncNotificationBridge";
    
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}

      {/* Dynamic Island — всегда рендерится, но видима только при нотификациях */}
      <DynamicIsland showIdle={false} />

      {/* Sync bridge — слушает Zustand, пушит нотификации об ошибках */}
      <SyncNotificationBridge />

      {/* Zen Mode — полноэкранный оверлей */}
      <ZenMode />
    </>
  );
}