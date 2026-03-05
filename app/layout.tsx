/**
 * @file layout.tsx — app (root)
 *
 * ОПТИМИЗАЦИЯ БАНДЛА v3:
 *  dynamic() с ssr: false перенесены в GlobalClientComponents.tsx.
 *  Server Component не может содержать { ssr: false } — ограничение Next.js 16.
 *
 * ПОРЯДОК МОНТИРОВАНИЯ ГЛОБАЛЬНЫХ СЛОЁВ (z-index):
 *  CommandPalette         (z-50)   — поиск и навигация
 *  DynamicIsland          (z-9998) — нотификации
 *  SyncNotificationBridge (нет DOM) — Zustand → нотификации bridge
 *  ZenMode                (z-9999) — полноэкранный фокус-режим
 */
import type { Metadata } from "next";
import { GlobalClientComponents } from "./GlobalClientComponents";
import "./globals.css";

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
        {/* CommandPalette, DynamicIsland, SyncNotificationBridge, ZenMode */}
        {/* Вынесены в Client Component — dynamic(ssr:false) нельзя в Server */}
        <GlobalClientComponents />
      </body>
    </html>
  );
}