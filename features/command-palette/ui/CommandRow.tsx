// features/command-palette/ui/CommandRow.tsx
"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import type { CommandItem } from "../model/fuzzy";

// ── Highlight matching substring ──────────────────────────────────────────────

function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query.trim()) return <>{text}</>;

  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background:   "rgba(139,92,246,0.28)",
          color:        "var(--accent-300)",
          borderRadius: 3,
          padding:      "0 1px",
          // Inherit font — never override
          font: "inherit",
        }}
      >
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

// ── Icon ──────────────────────────────────────────────────────────────────────

function CommandIcon({ icon, color }: { icon: string; color?: string }) {
  const isEmoji = /\p{Emoji}/u.test(icon);
  if (isEmoji) {
    return (
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
        style={{ backgroundColor: color ? `${color}22` : "var(--glass-02)" }}
      >
        {icon}
      </span>
    );
  }
  return (
    <span
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{
        backgroundColor: color ? `${color}22`         : "var(--glass-02)",
        border:          color ? `1px solid ${color}30` : "1px solid var(--glass-border)",
      }}
    >
      <span className="text-xs font-bold" style={{ color: color ?? "var(--text-muted)" }}>
        {icon}
      </span>
    </span>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface Props {
  cmd:        CommandItem;
  idx:        number;
  isSelected: boolean;
  /** Raw (non-debounced) query — used only for highlight rendering */
  searchQuery?: string;
  onHover:    () => void;
  onSelect:   () => void;
}

export const CommandRow = memo(function CommandRow({
  cmd,
  idx,
  isSelected,
  searchQuery = "",
  onHover,
  onSelect,
}: Props) {
  return (
    <motion.button
      id={`cp-item-${idx}`}
      data-idx={idx}
      role="option"
      aria-selected={isSelected}
      onMouseEnter={onHover}
      onClick={onSelect}
      layout
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100",
        "outline-none focus:outline-none",
      )}
      style={
        isSelected
          ? {
              background:   "rgba(139,92,246,0.12)",
              borderLeft:   "2px solid var(--accent-500)",
              paddingLeft:  "14px",
            }
          : { borderLeft: "2px solid transparent" }
      }
    >
      <CommandIcon icon={cmd.icon} color={cmd.color} />

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          {/* Show highlights only for task category results */}
          {cmd.category === "task" && searchQuery ? (
            <HighlightText text={cmd.label} query={searchQuery} />
          ) : (
            cmd.label
          )}
        </p>
        {cmd.description && (
          <p className="text-xs truncate mt-0.5 text-(--text-muted)">
            {cmd.description}
          </p>
        )}
      </div>

      {isSelected && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="shrink-0"
        >
          <svg
            className="w-4 h-4 text-(--accent-400)"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </motion.div>
      )}
    </motion.button>
  );
});