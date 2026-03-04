/**
 * @file layout.tsx — app (root)
 *
 * Root layout: dark mode enforced, fonts loaded.
 *
 * ПОРЯДОК МОНТИРОВАНИЯ ГЛОБАЛЬНЫХ СЛОЁВ (z-index):
 *  CommandPalette         (z-50)   — поиск и навигация
 *  DynamicIsland          (z-9998) — нотификации
 *  SyncNotificationBridge (нет DOM) — Zustand → нотификации bridge
 *  ZenMode                (z-9999) — полноэкранный фокус-режим
 *
 * WHY все три компонента живут в root layout:
 *  Они должны переживать навигацию без размонтирования.
 *  CommandPalette здесь по той же причине — объяснение сохранено.
 */
import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { ZenMode } from "@/features/zen-mode/ZenMode";
import { DynamicIsland } from "@/widgets/notifications/DynamicIsland";
import { SyncNotificationBridge } from "@/shared/lib/SyncNotificationBridge";

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "Premium intranet task management — 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="antialiased">
        {children}

        {/* ── Global UI Layer ─────────────────────────────────── */}

        {/* Command Palette: Cmd+K, z-50 */}
        <CommandPalette />

        {/* Dynamic Island: нотификации, top-center, z-9998 */}
        <DynamicIsland />

        {/* Sync Bridge: слушает Zustand syncStatus → пушит ошибки в Island */}
        <SyncNotificationBridge />

        {/* Zen Mode: полноэкранный оверлей, z-9999 */}
        <ZenMode />
      </body>
    </html>
  );
}