// features/sync/ui/IslandPill.tsx
"use client";
/**
 * ИСПРАВЛЕНИЕ (light-theme):
 *   - Текст пилюли: color: "var(--text-secondary)" — уже использует CSS var ✅
 *   - --island-bg теперь задан в globals.css для светлой темы
 *   - border: "var(--glass-border)" вместо hardcoded
 */
import { motion } from "framer-motion";
import type { Notification } from "../useNotificationStore";

const KIND_GLOW: Record<string, string> = {
  success: "rgba(52,211,153,0.5)",
  error:   "rgba(239,68,68,0.5)",
  sync:    "rgba(56,189,248,0.45)",
  zen:     "rgba(139,92,246,0.5)",
  info:    "rgba(0,0,0,0.1)",
};

const KIND_DOT: Record<string, string> = {
  success: "#34d399",
  error:   "#ef4444",
  sync:    "#38bdf8",
  zen:     "#a78bfa",
  info:    "#94a3b8",
};

interface Props {
  notification: Notification | null;
  onClick: () => void;
}

export function IslandPill({ notification, onClick }: Props) {
  const glow = notification ? KIND_GLOW[notification.kind] ?? KIND_GLOW.info : "var(--glass-border)";
  const dot  = notification ? KIND_DOT[notification.kind]  ?? KIND_DOT.info  : "#94a3b8";

  return (
    <motion.button
      onClick={onClick}
      className="relative flex items-center gap-2 px-3 py-1.5 overflow-hidden"
      style={{
        borderRadius: "20px",
        background:   "var(--island-bg)",
        border:       "1px solid var(--glass-border)",
        cursor:       notification ? "pointer" : "default",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      animate={{ boxShadow: `0 0 12px ${glow}, 0 2px 8px rgba(0,0,0,0.15)` }}
      transition={{ duration: 0.4 }}
      whileHover={notification ? { scale: 1.02 } : {}}
      whileTap={notification ? { scale: 0.98 } : {}}
    >
      {/* Animated dot */}
      <motion.div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dot }}
        animate={notification
          ? { scale: [1, 1.35, 1], opacity: [0.9, 1, 0.9] }
          : { scale: 1, opacity: 0.3 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Label */}
      <motion.span
        className="text-xs font-medium font-mono"
        style={{ color: "var(--text-secondary)" }}
        animate={{ opacity: notification ? 1 : 0.35 }}
      >
        {notification ? notification.title : "в сети"}
      </motion.span>

      {/* Shimmer sweep */}
      {notification && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 40%, var(--glass-01) 50%, transparent 60%)",
          }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }}
        />
      )}
    </motion.button>
  );
}