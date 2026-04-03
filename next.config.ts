/**
 * @file next.config.ts
 *
 * ШАГ 2 — PWA:
 *   Добавлен @ducanh2912/next-pwa для offline-first.
 *
 *   withPWA оборачивает конфиг и генерирует /public/sw.js при `next build`.
 *   В dev-режиме PWA отключён (disable: process.env.NODE_ENV === "development")
 *   чтобы не мешать HMR.
 *
 *   КЕШИРУЕТСЯ:
 *   - App shell: /_next/static/** (CSS, JS, fonts)
 *   - /_next/image/** (оптимизированные изображения)
 *   - /api/health (пинг)
 *   - Все страницы (start_url: "/") через NetworkFirst
 *
 *   INSTALL BANNER: браузер предложит «Установить приложение» после
 *   второго посещения. После установки сайт открывается из кеша без сети.
 *
 *   ТРЕБУЕТСЯ: bun add @ducanh2912/next-pwa
 *
 * ОРИГИНАЛЬНЫЕ ОПТИМИЗАЦИИ СОХРАНЕНЫ:
 *   - optimizePackageImports: framer-motion, lucide-react, date-fns
 *   - turbopack.resolveExtensions
 *   - compress, poweredByHeader, reactStrictMode
 */
import type { NextConfig } from "next";

const nextConfigBase: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,

  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "date-fns",
    ],
  },

  turbopack: {
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
  },
};

// Оборачиваем в withPWA только если пакет доступен
// (чтобы не сломать dev-окружение где пакет ещё не установлен)
let nextConfig: NextConfig;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withPWA = require("@ducanh2912/next-pwa").default({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true,
    skipWaiting: true,
    sw: "/sw.js",
    // Workbox runtime caching
    workboxOptions: {
      // Стратегия для страниц: NetworkFirst → offline fallback из кеша
      runtimeCaching: [
        {
          // App shell — статика Next.js (JS/CSS/fonts)
          urlPattern: /^\/_next\/static\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "next-static",
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 дней
            },
          },
        },
        {
          // Next.js image optimization
          urlPattern: /^\/_next\/image\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "next-images",
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 7, // 7 дней
            },
          },
        },
        {
          // API health check — online indicator
          urlPattern: /^\/api\/health$/i,
          handler: "NetworkFirst",
          options: {
            cacheName: "api-health",
            networkTimeoutSeconds: 5,
          },
        },
        {
          // Все страницы приложения — NetworkFirst с offline-fallback
          urlPattern: /^\/(?!api\/).*/i,
          handler: "NetworkFirst",
          options: {
            cacheName: "pages",
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24, // 24 часа
            },
          },
        },
      ],
    },
  });

  nextConfig = withPWA(nextConfigBase);
} catch {
  // Fallback: если @ducanh2912/next-pwa не установлен
  console.warn("[next.config] @ducanh2912/next-pwa не найден — PWA отключён.");
  console.warn("[next.config] Установите: bun add @ducanh2912/next-pwa");
  nextConfig = nextConfigBase;
}

export default nextConfig;