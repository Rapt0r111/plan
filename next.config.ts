/**
 * @file next.config.ts
 *
 * ОПТИМИЗАЦИИ БАНДЛА:
 *
 * 1. optimizePackageImports — критично для framer-motion.
 *    Без этого Next.js импортирует ВСЮ библиотеку (~160kB gzip).
 *    С этим — только используемые экспорты (tree-shaking на уровне сборщика).
 *    Экономия: ~60–80kB gzip от framer-motion.
 *
 * 2. compress: true — gzip для статики (включён по умолчанию в prod,
 *    явно указываем для ясности).
 *
 * 3. poweredByHeader: false — убираем лишний заголовок X-Powered-By.
 *
 * 4. reactStrictMode: true — в дев-режиме двойной рендер помогает
 *    поймать side-effects. В prod не влияет на производительность.
 *
 * 5. turbo.resolveExtensions — явный список расширений для Turbopack,
 *    ускоряет резолюцию модулей.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,

  experimental: {
    /**
     * Tree-shaking тяжёлых библиотек.
     * framer-motion: без оптимизации = 160kB gzip, с ней = ~40-60kB gzip
     * (только motion, AnimatePresence, useMotionValue которые реально используются)
     */
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "date-fns",
    ],
  },

  /**
   * Turbopack: явно указываем расширения для быстрой резолюции.
   * Без этого Turbopack пробует все расширения подряд.
   */
  turbopack: {
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
  },
};

export default nextConfig;