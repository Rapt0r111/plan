// features/timeline/ui/TimelineRow.tsx
"use client";
import { EpicBar } from "./EpicBar";
import type { Bar } from "../model/useTimelineLayout";
import { LANE_H, LEFT_W } from "../model/useTimelineLayout";

interface Props {
  bar: Bar;
  index: number;
  hovered: boolean;
  onHover: (v: boolean) => void;
  onOpenModal: (epicId: number) => void;
}

export function TimelineRow({ bar, index, hovered, onHover, onOpenModal }: Props) {
  const { epic, pct, overdue } = bar;
  const donePct = Math.round(pct * 100);
  const accentColor = overdue ? "#f87171" : epic.color;

  return (
    <div
      className="flex relative"
      style={{
        height: LANE_H,
        background: index % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        zIndex: 1,
      }}
    >
      {/* Sticky label */}
      <div
        className="shrink-0 sticky left-0 z-10 flex items-center gap-2 px-3"
        style={{
          width: LEFT_W,
          background: hovered
            ? `linear-gradient(90deg, ${accentColor}12, ${index % 2 === 0 ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.06)"})`
            : index % 2 === 0 ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.06)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          transition: "background 0.18s",
        }}
      >
        <div
          className="w-0.5 self-stretch my-2.5 rounded-full shrink-0 transition-opacity"
          style={{ backgroundColor: accentColor, opacity: hovered ? 1 : 0.4 }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium leading-tight truncate"
            style={{ color: hovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)", transition: "color 0.18s" }}>
            {epic.title}
          </p>
          <p className="text-[9px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
            {epic.progress.done}/{epic.progress.total}
          </p>
        </div>
        <span className="text-[10px] font-bold font-mono shrink-0 transition-colors"
          style={{ color: `${accentColor}${hovered ? "ff" : "70"}` }}>
          {donePct}%
        </span>
      </div>

      {/* Bar area */}
      <div className="relative flex-1">
        {hovered && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `${accentColor}07` }} />
        )}
        <EpicBar
          bar={bar} hovered={hovered} onHover={onHover}
          onClick={() => onOpenModal(epic.id)}
        />
      </div>
    </div>
  );
}