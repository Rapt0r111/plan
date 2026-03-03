/**
 * @file GlassPanel.tsx — shared/ui
 *
 * The foundational surface component for the Deep Cosmos design system.
 *
 * UX rationale: Glass morphism with controlled blur depth creates a clear
 * visual hierarchy — deeper panels "feel" further away. The three variants
 * map to: base content (sm), interactive cards (md), modal/overlay (lg).
 * The accent border option draws attention without using aggressive color.
 */
import { cn } from "@/shared/lib/utils";
import type { JSX, ReactNode } from "react";

type Variant = "sm" | "md" | "lg" | "elevated";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  variant?: Variant;
  /** Renders an amethyst glow border — use sparingly for focus/active states */
  accent?: boolean;
  /** Renders a subtle top-edge highlight for depth illusion */
  highlight?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

const variantClasses: Record<Variant, string> = {
  sm:       "bg-[var(--glass-01)] backdrop-blur-md border border-[var(--glass-border)]",
  md:       "bg-[var(--glass-02)] backdrop-blur-xl border border-[var(--glass-border)]",
  lg:       "bg-[var(--bg-elevated)] backdrop-blur-2xl border border-[var(--glass-border)]",
  elevated: "bg-[var(--bg-elevated)] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
};

export function GlassPanel({
  children,
  className,
  variant = "md",
  accent = false,
  highlight = false,
  as: Tag = "div",
}: GlassPanelProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl transition-all duration-200",
        variantClasses[variant],
        accent && "border-[rgba(139,92,246,0.35)] shadow-[0_0_20px_rgba(139,92,246,0.15)]",
        highlight && "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/15 before:to-transparent before:rounded-t-2xl before:content-[''] relative overflow-hidden",
        className
      )}
    >
      {children}
    </Tag>
  );
}