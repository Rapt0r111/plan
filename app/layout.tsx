/**
 * @file layout.tsx — app (root)
 *
 * ШАГ 2 — PWA:
 *   Добавлены мета-теги и ссылка на manifest.json для PWA.
 *   Добавлены apple-touch-icon и mobile-web-app-capable для iOS.
 *
 * LIGHT THEME v4:
 *  - Убран className="dark" с <html> — управляется скриптом + ThemeProvider
 *  - Инлайн-скрипт в <head> устраняет FOUC (flash of unstyled content)
 *  - ThemeProvider читает localStorage/prefers-color-scheme при гидрации
 *
 * HYDRATION FIX:
 *  suppressHydrationWarning добавлен к <html>.
 */
import type { Metadata, Viewport } from "next";
import { GlobalClientComponents } from "./GlobalClientComponents";
import { ThemeProvider } from "@/shared/ui/ThemeProvider";
import { OfflineBanner } from "@/shared/ui/OfflineBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "Premium intranet task management — 2026",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TaskFlow",
  },
  icons: {
    apple: "/icons/icon-192.png",
    icon: "/icons/icon-192.png",
  },
};

// viewport вынесен в отдельный экспорт — требование Next.js 14+
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#06070d" },
    { media: "(prefers-color-scheme: light)", color: "#ece8e0" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* Anti-FOUC: тема применяется до первого paint */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var t=s==='light'||s==='dark'?s:window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {/* ── Offline status — above everything, including modals ── */}
          <OfflineBanner />

          {children}

          {/* ── Global UI Layer ─────────────────────────────────── */}
          <GlobalClientComponents />
        </ThemeProvider>
      </body>
    </html>
  );
}