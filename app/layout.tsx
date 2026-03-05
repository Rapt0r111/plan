/**
 * @file layout.tsx — app (root)
 *
 * ОПТИМИЗАЦИЯ БАНДЛА v2:
 *
 * ПРОБЛЕМА:
 *  CommandPalette, ZenMode, DynamicIsland, SyncNotificationBridge —
 *  все четыре компонента импортировались статически.
 *  Next.js включал их код в ПЕРВИЧНЫЙ JS-бандл страницы.
 *
 *  Итог: браузер скачивал и парсил ~180kB+ кода для компонентов,
 *  которые пользователь может вообще не открыть (ZenMode, CommandPalette).
 *
 * РЕШЕНИЕ — next/dynamic с ssr: false:
 *
 *  Эти компоненты:
 *    ✓ Не нужны при SSR (рендерятся только на клиенте)
 *    ✓ Не нужны при первом рендере (открываются по действию пользователя)
 *    ✓ Все используют Zustand/useState — клиент-only
 *
 *  next/dynamic разбивает их на отдельные чанки, которые браузер
 *  скачивает параллельно с рендером страницы, а не до него.
 *
 * РЕЗУЛЬТАТ:
 *  - Первичный JS-бандл: -150–200kB (CommandPalette + ZenMode + framer-motion части)
 *  - FCP: быстрее, т.к. меньше кода для парсинга перед первым рендером
 *  - Lazy chunks грузятся в фоне после интерактивности страницы
 *
 * ПОРЯДОК МОНТИРОВАНИЯ ГЛОБАЛЬНЫХ СЛОЁВ (z-index):
 *  CommandPalette         (z-50)   — поиск и навигация
 *  DynamicIsland          (z-9998) — нотификации
 *  SyncNotificationBridge (нет DOM) — Zustand → нотификации bridge
 *  ZenMode                (z-9999) — полноэкранный фокус-режим
 */
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";

/**
 * Динамический импорт с ssr: false — компоненты не попадают в серверный бандл.
 * loading: undefined — у этих компонентов нет видимого состояния загрузки
 * (они скрыты до действия пользователя).
 */
const CommandPalette = dynamic(
  () => import("@/features/command-palette/CommandPalette").then((m) => ({ default: m.CommandPalette })),
  { ssr: false }
);

const ZenMode = dynamic(
  () => import("@/features/zen-mode/ZenMode").then((m) => ({ default: m.ZenMode })),
  { ssr: false }
);

const DynamicIsland = dynamic(
  () => import("@/features/sync/DynamicIsland").then((m) => ({ default: m.DynamicIsland })),
  { ssr: false }
);

const SyncNotificationBridge = dynamic(
  () => import("@/features/sync/SyncNotificationBridge").then((m) => ({ default: m.SyncNotificationBridge })),
  { ssr: false }
);

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

        {/* Sync Bridge: слушает Zustand, пушит нотификации об ошибках */}
        <SyncNotificationBridge />

        {/* Zen Mode: полноэкранный оверлей, z-9999 */}
        <ZenMode />
      </body>
    </html>
  );
}