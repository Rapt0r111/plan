// features/sync/ui/IslandExpanded.tsx
"use client";
import { motion } from "framer-motion";
import type { Notification } from "../useNotificationStore";

const KIND_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.22)",  text: "#34d399", icon: "✓" },
  error:   { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.22)",   text: "#f87171", icon: "✕" },
  sync:    { bg: "rgba(56,189,248,0.07)",  border: "rgba(56,189,248,0.2)",   text: "#38bdf8", icon: "⟳" },
  zen:     { bg: "rgba(139,92,246,0.08)",  border: "rgba(139,92,246,0.22)",  text: "#a78bfa", icon: "◈" },
  info:    { bg: "var(--glass-01)",        border: "var(--glass-border)",    text: "#94a3b8", icon: "i" },
};

interface Props {
  notification: Notification;
  onDismiss: () => void;
}

export function IslandExpanded({ notification, onDismiss }: Props) {
  const c = KIND_COLORS[notification.kind] ?? KIND_COLORS.info;

  return (
    <motion.div
      key={notification.id}
      initial={{ opacity: 0, y: -6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="w-full flex items-start gap-3"
      style={{
        borderRadius: "16px",
        background:   c.bg,
        border:       `1px solid ${c.border}`,
        padding:      "10px 12px",
        boxShadow:    `0 0 20px ${c.border}`,
      }}
    >
      {/* Kind icon */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-px text-xs font-bold"
        style={{ background: `${c.text}18`, color: c.text, border: `1px solid ${c.text}30` }}
      >
        {notification.icon ?? c.icon}
      </div>

      {/* Content — use CSS vars so text is readable in both themes */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p
            className="text-xs mt-0.5 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {notification.body}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors mt-px"
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
      >
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M2 2l8 8M10 2L2 10" />
        </svg>
      </button>
    </motion.div>
  );
}