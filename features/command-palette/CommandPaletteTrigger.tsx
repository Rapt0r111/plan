// features/command-palette/CommandPaletteTrigger.tsx
"use client";
import { cn } from "@/shared/lib/utils";
import { useCommandPaletteStore } from "./useCommandPaletteStore";

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
      style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)",
        color: "var(--text-muted)" }}>
      {children}
    </kbd>
  );
}

interface Props { className?: string; }

export function CommandPaletteTrigger({ className }: Props) {
  const { open } = useCommandPaletteStore();
  const isMac = typeof navigator !== "undefined"
    && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <button
      onClick={() => open()}
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all duration-200",
        "hover:bg-(--glass-02)",
        className
      )}
      style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)",
        color: "var(--text-muted)" }}
    >
      <svg className="w-3.5 h-3.5 group-hover:text-(--text-secondary) transition-colors"
        viewBox="0 0 16 16" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round">
        <circle cx="7" cy="7" r="4.5" />
        <path d="m11 11 2.5 2.5" />
      </svg>
      <span className="group-hover:text-(--text-secondary) transition-colors">Поиск</span>
      <div className="flex items-center gap-0.5 ml-1">
        <KbdHint>{isMac ? "⌘" : "Ctrl"}</KbdHint>
        <KbdHint>K</KbdHint>
      </div>
    </button>
  );
}