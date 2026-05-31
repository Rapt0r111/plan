"use client";
/**
 * @file UserMenu.tsx ? shared/ui
 * Animated account dropdown with outside-click close and viewport-safe panel.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";

interface Props {
  userId: string;
  name: string;
  login: string | null | undefined;
  role: string;
  compact?: boolean;
}

export function UserMenu({ name, login, role, compact = false }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "group flex w-full cursor-pointer items-center rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--glass-02)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          compact ? "h-11 justify-center px-0" : "gap-2.5 px-3 py-2.5",
          open ? "border-[var(--glass-border-active)] bg-[var(--glass-02)] shadow-[0_12px_28px_rgba(0,0,0,0.16)]" : "border-[var(--glass-border)] bg-[var(--glass-01)]"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        title={compact ? name : undefined}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-1 ring-white/10"
          style={{
            background: role === "admin" ? "linear-gradient(135deg, #14b8a6, #8b5cf6)" : "linear-gradient(135deg, #64748b, #334155)",
            boxShadow: role === "admin" ? "0 0 18px rgba(20,184,166,0.28)" : "none",
          }}
        >
          {initials}
        </div>
        {!compact && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-medium text-[var(--text-primary)]">{name}</p>
              <p className="truncate text-[10px] font-mono text-[var(--text-muted)]">
                {login ? `@${login}` : role === "admin" ? "Администратор" : "Участник"}
              </p>
            </div>
            <motion.svg
              className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path d="M2 4l4 4 4-4" />
            </motion.svg>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-4 left-3 z-50 max-h-[min(70dvh,360px)] w-[min(calc(var(--sidebar-w)-24px),calc(100vw-24px))] overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl"
          >
            <div className="border-b border-[var(--glass-border)] px-3 py-3">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">
                {login ? `@${login}` : role === "admin" ? "Администратор" : "Участник"}
              </p>
            </div>

            <div className="max-h-[calc(min(70dvh,360px)-72px)] overflow-y-auto p-1.5">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-01)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)]"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="5" r="3" />
                  <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                </svg>
                Профиль
              </Link>

              {role === "admin" && (
                <div className="mx-2 my-1 rounded-2xl border border-[rgba(20,184,166,0.24)] bg-teal-400/10 px-3 py-2 text-[11px] font-medium text-teal-200">
                  Администратор
                </div>
              )}

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M10 12v1.5a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 1 13.5v-11A1.5 1.5 0 0 1 2.5 1h6A1.5 1.5 0 0 1 10 2.5V4M7 8h8M13 6l2 2-2 2" />
                </svg>
                {loggingOut ? "Выход..." : "Выйти"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
