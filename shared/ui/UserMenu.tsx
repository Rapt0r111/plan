"use client";
/**
 * @file UserMenu.tsx — shared/ui
 * Shows current session user with logout button.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  userId: string;
  name: string;
  login: string | null | undefined;
  role: string;
}

export function UserMenu({ name, login, role }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl transition-all"
        style={{
          background: open ? "var(--glass-02)" : "transparent",
          border: open ? "1px solid var(--glass-border)" : "1px solid transparent",
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{
            backgroundColor: role === "admin" ? "#8b5cf6" : "#64748b",
            boxShadow: role === "admin" ? "0 0 8px rgba(139,92,246,0.4)" : "none",
          }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {name}
          </p>
          <p className="text-[10px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
            {login ? `@${login}` : role === "admin" ? "Администратор" : "Участник"}
          </p>
        </div>
        <motion.svg
          className="w-3 h-3 shrink-0"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ color: "var(--text-muted)" }}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path d="M2 4l4 4 4-4" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden shadow-2xl z-50"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
          >
            {role === "admin" && (
              <div
                className="px-3 py-2 flex items-center gap-2 border-b"
                style={{ borderColor: "var(--glass-border)" }}
              >
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(139,92,246,0.12)",
                    color: "#a78bfa",
                    border: "1px solid rgba(139,92,246,0.3)",
                  }}
                >
                  ✦ Администратор
                </span>
              </div>
            )}

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm transition-colors"
              style={{ color: loggingOut ? "var(--text-muted)" : "#f87171" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <svg
                className="w-4 h-4 shrink-0"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}