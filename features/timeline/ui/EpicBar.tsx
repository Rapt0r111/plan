// features/timeline/ui/EpicBar.tsx
"use client";
import { motion } from "framer-motion";
import { formatDate } from "@/shared/lib/utils";
import { useShinyEffect } from "@/shared/lib/hooks/useShinyEffect";
import type { Bar } from "../model/useTimelineLayout";
import { LANE_H } from "../model/useTimelineLayout";

interface Props {
  bar: Bar;
  hovered: boolean;
  onHover: (v: boolean) => void;
  onClick: () => void;
}

export function EpicBar({ bar, hovered, onHover, onClick }: Props) {
  const { epic, barX, barW, pct, hasDates, overdue } = bar;
  const donePct = Math.round(pct * 100);
  const accentColor = overdue ? "#dc2626" : epic.color;

  const { shineStyle, auroraStyle, onMouseMove, onMouseLeave: shineLeave } = useShinyEffect({
    accentColor, intensity: 0.09, auroraIntensity: 0.14, stiffness: 300, damping: 22,
  });

  return (
    <motion.div
      className="absolute top-1/2 -translate-y-1/2 rounded-lg overflow-hidden"
      style={{
        left: barX,
        width: barW,
        height: LANE_H - 20,
        cursor: "pointer",
        // Фон полосы — чуть насыщеннее в hover для обеих тем
        background: hovered ? `${accentColor}22` : `${accentColor}12`,
        border: `1px solid ${accentColor}${hovered ? "60" : "35"}`,
        pointerEvents: "auto",
      }}
      animate={{
        boxShadow: hovered
          ? `0 0 16px ${accentColor}30, 0 2px 8px rgba(0,0,0,0.15)`
          : "none",
      }}
      transition={{ duration: 0.18 }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => { onHover(false); shineLeave(); }}
      onMouseMove={onMouseMove}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <motion.div className="absolute inset-0 pointer-events-none" style={shineStyle} />
      <motion.div className="absolute inset-0 pointer-events-none" style={auroraStyle} />

      {/* Top accent line — более заметная */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: 2,
          background: accentColor,
          opacity: hovered ? 1 : 0.6,
        }}
      />

      {/* Progress fill */}
      {pct > 0 && (
        <div
          className="absolute inset-y-0 left-0 rounded-l-lg"
          style={{
            width: `${donePct}%`,
            background: `${accentColor}20`,
            borderRight: `1px solid ${accentColor}40`,
            transition: "width 0.5s ease",
          }}
        />
      )}

      {/* Default label */}
      {!hovered && (
        <div className="relative h-full flex flex-col justify-center px-2.5 overflow-hidden">
          <span
            className="text-[11px] font-semibold font-mono leading-tight"
            style={{ color: accentColor }}
          >
            {donePct}%{overdue ? " · просроч." : ""}
          </span>
          {hasDates && epic.endDate && barW >= 120 && (
            <span
              className="text-[9px] font-mono leading-tight mt-0.5"
              style={{ color: "var(--text-muted)" }}   // ← был rgba(255,255,255,0.25)
            >
              {epic.startDate ? formatDate(epic.startDate) : "?"} → {formatDate(epic.endDate)}
            </span>
          )}
        </div>
      )}

      {/* Hover label */}
      {hovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative h-full flex items-center justify-center gap-1.5"
        >
          <span
            className="text-[11px] font-medium font-mono"
            style={{ color: accentColor }}
          >
            подробнее
          </span>
          <svg
            className="w-3 h-3"
            style={{ color: accentColor }}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2 6h8M6 2l4 4-4 4" />
          </svg>
        </motion.div>
      )}
    </motion.div>
  );
}