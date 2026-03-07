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
  const accentHex   = overdue ? "#dc2626" : epic.color; // нужен hex для rgba()

  return (
    <div
      className="flex relative"
      style={{
        height: LANE_H,
        // Чередующиеся строки — используем glass-01 вместо белого/прозрачного
        background: index % 2 === 0 ? "var(--glass-01)" : "transparent",
        borderBottom: "1px solid var(--glass-border)",
        zIndex: 1,
      }}
    >
      {/* Sticky label */}
      <div
        className="shrink-0 sticky left-0 z-10 flex items-center gap-2 px-3"
        style={{
          width: LEFT_W,
          // Фон лейбла — поверхность, а не полупрозрачный чёрный
          background: hovered
            ? `linear-gradient(90deg, ${accentHex}18, var(--bg-surface))`
            : "var(--bg-surface)",
          borderRight: "1px solid var(--glass-border)",
          transition: "background 0.18s",
        }}
      >
        <div
          className="w-0.5 self-stretch my-2.5 rounded-full shrink-0 transition-opacity"
          style={{ backgroundColor: accentHex, opacity: hovered ? 1 : 0.5 }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] font-medium leading-tight truncate"
            style={{
              color: hovered ? "var(--text-primary)" : "var(--text-secondary)",
              transition: "color 0.18s",
            }}
          >
            {epic.title}
          </p>
          <p className="text-[9px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
            {epic.progress.done}/{epic.progress.total}
          </p>
        </div>
        <span
          className="text-[10px] font-bold font-mono shrink-0 transition-colors"
          style={{ color: hovered ? accentHex : "var(--text-muted)" }}
        >
          {donePct}%
        </span>
      </div>

      {/* Bar area */}
      <div className="relative flex-1">
        {hovered && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `${accentHex}08` }}
          />
        )}
        <EpicBar
          bar={bar}
          hovered={hovered}
          onHover={onHover}
          onClick={() => onOpenModal(epic.id)}
        />
      </div>
    </div>
  );
}