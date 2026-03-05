/**
 * @file Header.tsx — widgets/header
 *
 * Sticky frosted-glass top bar.
 * Includes CommandPaletteTrigger and ThemeToggle.
 * Background uses var(--header-bg) — theme-aware token.
 */
import type { ReactNode } from "react";
import { CommandPaletteTrigger } from "@/features/command-palette/CommandPaletteTrigger";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Header({ title, subtitle, actions }: Props) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center px-6 gap-4"
      style={{
        height: "var(--header-h)",
        background: "var(--header-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--glass-border)",
      }}
    >
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-(--text-primary) truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-(--text-muted) truncate font-mono">
            {subtitle}
          </p>
        )}
      </div>

      {/* Command palette trigger — sits centre-right, always visible */}
      <CommandPaletteTrigger />

      {/* Theme toggle */}
      <ThemeToggle />

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}