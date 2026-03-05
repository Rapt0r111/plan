// features/timeline/ui/Ring.tsx
interface RingProps {
  pct: number;
  color: string;
  size?: number;
}

export function Ring({ pct, color, size = 40 }: RingProps) {
  const r = (size - 6) / 2;
  const C = 2 * Math.PI * r;

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={3}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.7s ease" }}
        />
      </svg>
      <span
        className="relative text-[10px] font-bold font-mono"
        style={{ color }}
      >
        {pct}%
      </span>
    </div>
  );
}