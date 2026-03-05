"use client";
/**
 * @file GlobalClientComponents.tsx — app
 *
 * Client Component — обёртка для глобальных UI-компонентов с ssr: false.
 *
 * ПРИЧИНА ВЫДЕЛЕНИЯ:
 *  В Next.js 16 dynamic() с { ssr: false } нельзя использовать в Server Components.
 *  layout.tsx — Server Component, поэтому dynamic-импорты с ssr: false
 *  вынесены сюда, в отдельный "use client" модуль.
 *
 * Этот компонент не рендерит никакой разметки — только монтирует
 * глобальные слои: CommandPalette, DynamicIsland, SyncNotificationBridge, ZenMode.
 */
import dynamic from "next/dynamic";

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

export function GlobalClientComponents() {
  return (
    <>
      <CommandPalette />
      <DynamicIsland />
      <SyncNotificationBridge />
      <ZenMode />
    </>
  );
}