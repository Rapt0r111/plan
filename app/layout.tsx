/**
 * @file layout.tsx — app (root)
 * Server Component — fetches epics + users once, passes down.
 * Dark mode enforced via `dark` class on <html>.
 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "Premium intranet task management — 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}