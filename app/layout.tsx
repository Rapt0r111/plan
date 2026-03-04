/**
 * @file layout.tsx — app (root)
 *
 * Root layout: dark mode enforced, fonts loaded, Command Palette mounted.
 *
 * WHY CommandPalette lives HERE (not in MainLayout):
 *  The palette must survive route transitions without unmounting — if placed
 *  inside (main)/layout.tsx it would remount on every navigation, losing
 *  the animation state and re-reading epics from scratch.
 *  Mounting at root keeps a single instance alive for the entire session.
 *
 *  StoreHydrator in /board/page.tsx fills the Zustand store with epics —
 *  the palette reads from that store reactively.
 */
import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/features/command-palette/CommandPalette";

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "Premium intranet task management — 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="antialiased">
        {children}
        {/*
         * Command Palette: mounted once at root, portal-like.
         * Visible from ANY route. Zero prop-drilling — reads Zustand directly.
         * Shortcut: Cmd+K / Ctrl+K (registered inside CommandPalette via useKeyboardShortcuts)
         */}
        <CommandPalette />
      </body>
    </html>
  );
}