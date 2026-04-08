// features/command-palette/ui/PaletteFooter.tsx
/**
 * ИСПРАВЛЕНИЕ (light-theme):
 *   - borderTop: "1px solid rgba(255,255,255,0.06)" → var(--glass-border)
 *   - background: "rgba(255,255,255,0.015)" → var(--glass-01)
 */

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
      style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)",
        color: "var(--text-muted)" }}>
      {children}
    </kbd>
  );
}

export function PaletteFooter() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{
        borderTop: "1px solid var(--glass-border)",
        background: "var(--glass-01)",
      }}
    >
      <div className="flex items-center gap-1.5 text-xs text-(--text-muted)">
        <KbdHint>↑</KbdHint>
        <KbdHint>↓</KbdHint>
        <span>навигация</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-(--text-muted)">
        <KbdHint>↵</KbdHint>
        <span>выбрать</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs ml-auto"
        style={{ color: "rgba(139,92,246,0.5)" }}>
        <span className="font-mono">◈</span>
        <span>zen</span>
      </div>
    </div>
  );
}