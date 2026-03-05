// features/timeline/ui/TimelineRuler.tsx
import { LEFT_W } from "../model/useTimelineLayout";
import type { TimelineLayout } from "../model/useTimelineLayout";

interface Props {
  layout: Pick<TimelineLayout, "months" | "todayX">;
}

export function TimelineRuler({ layout }: Props) {
  const { months, todayX } = layout;

  return (
    <div
      className="sticky top-0 z-20 flex"
      style={{
        height: 44,
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--glass-border)",
      }}
    >
      {/* Left label cell */}
      <div
        className="shrink-0 flex items-end px-4 pb-2 sticky left-0 z-30"
        style={{
          width: LEFT_W,
          background: "var(--bg-elevated)",
          borderRight: "1px solid var(--glass-border)",
        }}
      >
        <span
          className="text-[9px] font-mono uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Эпик
        </span>
      </div>

      {/* Month labels + today pill */}
      <div className="relative flex-1">
        {months.map(({ x, label, isJan }) => (
          <div
            key={`m-${x}`}
            className="absolute top-0 bottom-0 flex items-end pb-2 pl-2"
            style={{ left: x }}
          >
            <span
              className="text-[11px] font-mono whitespace-nowrap capitalize"
              style={{
                color: isJan ? "var(--text-secondary)" : "var(--text-muted)",
                fontWeight: isJan ? 600 : 400,
              }}
            >
              {label}
            </span>
          </div>
        ))}

        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ left: todayX, transform: "translateX(-50%)", zIndex: 10 }}
        >
          <span
            className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
              background: "var(--accent-500)",
              color: "white",
              boxShadow: "0 0 10px var(--accent-glow-strong)",
            }}
          >
            СЕГОДНЯ
          </span>
        </div>
      </div>
    </div>
  );
}