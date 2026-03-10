/**
 * @file layout.tsx — app (root)
 *
 * LIGHT THEME v4:
 *  - Убран className="dark" с <html> — управляется скриптом + ThemeProvider
 *  - Инлайн-скрипт в <head> устраняет FOUC (flash of unstyled content)
 *  - ThemeProvider читает localStorage/prefers-color-scheme при гидрации
 *
 * HYDRATION FIX:
 *  suppressHydrationWarning добавлен к <html>.
 *  Причина: инлайн-скрипт устанавливает className="light"|"dark" ДО React,
 *  поэтому сервер рендерит <html lang="ru"> (без класса), а клиент видит
 *  класс выставленный скриптом. React пытается "починить" расхождение и
 *  удаляет класс — тема перестаёт работать.
 *  suppressHydrationWarning говорит React: «не трогай атрибуты этого элемента».
 *
 * ПОРЯДОК МОНТИРОВАНИЯ ГЛОБАЛЬНЫХ СЛОЁВ (z-index):
 *  OfflineBanner          (z-9999) — сетевой статус (самый верхний)
 *  CommandPalette         (z-50)   — поиск и навигация
 *  DynamicIsland          (z-9998) — нотификации
 *  SyncNotificationBridge (нет DOM) — Zustand → нотификации bridge
 *  ZenMode                (z-9999) — полноэкранный фокус-режим
 */
import type { Metadata } from "next";
import { GlobalClientComponents } from "./GlobalClientComponents";
import { ThemeProvider } from "@/shared/ui/ThemeProvider";
import { OfflineBanner } from "@/shared/ui/OfflineBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "Premium intranet task management — 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* Anti-FOUC: тема применяется до первого paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.className=t;}else if(window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.className='light';}else{document.documentElement.className='dark';}}catch(e){document.documentElement.className='dark';}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {/* ── Offline status — above everything, including modals ── */}
          <OfflineBanner />

          {children}

          {/* ── Global UI Layer ─────────────────────────────────── */}
          {/* CommandPalette, DynamicIsland, SyncNotificationBridge, ZenMode */}
          {/* Вынесены в Client Component — dynamic(ssr:false) нельзя в Server */}
          <GlobalClientComponents />
        </ThemeProvider>
      </body>
    </html>
  );
}