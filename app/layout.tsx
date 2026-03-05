/**
 * @file layout.tsx — app (root)
 *
 * LIGHT THEME v4:
 *  - Убран className="dark" с <html> — управляется скриптом + ThemeProvider
 *  - Инлайн-скрипт в <head> устраняет FOUC (flash of unstyled content)
 *  - ThemeProvider читает localStorage/prefers-color-scheme при гидрации
 *
 * ПОРЯДОК МОНТИРОВАНИЯ ГЛОБАЛЬНЫХ СЛОЁВ (z-index):
 *  CommandPalette         (z-50)   — поиск и навигация
 *  DynamicIsland          (z-9998) — нотификации
 *  SyncNotificationBridge (нет DOM) — Zustand → нотификации bridge
 *  ZenMode                (z-9999) — полноэкранный фокус-режим
 */
import type { Metadata } from "next";
import { GlobalClientComponents } from "./GlobalClientComponents";
import { ThemeProvider } from "@/shared/ui/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "Premium intranet task management — 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Anti-FOUC: тема применяется до первого paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.className=t;}else if(window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.className='light';}else{document.documentElement.className='dark';}}catch(e){document.documentElement.className='dark';}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
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