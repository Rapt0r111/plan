import type { ButtonHTMLAttributes, CSSProperties } from "react";

import { cn } from "@/shared/lib/utils";

type ActionButtonVariant = "primary" | "success" | "danger" | "warning" | "muted";
type ActionButtonSize = "md" | "sm";

const variantStyles: Record<ActionButtonVariant, CSSProperties> = {
  primary: {
    background: "rgba(34,197,94,0.16)",
    border: "1px solid rgba(34,197,94,0.34)",
    color: "#34d399",
  },
  success: {
    background: "rgba(52,211,153,0.13)",
    border: "1px solid rgba(52,211,153,0.30)",
    color: "#34d399",
  },
  danger: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.28)",
    color: "#f87171",
  },
  warning: {
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.28)",
    color: "#fbbf24",
  },
  muted: {
    background: "var(--glass-01)",
    border: "1px solid var(--glass-border)",
    color: "var(--text-secondary)",
  },
};

const sizeClasses: Record<ActionButtonSize, string> = {
  md: "rounded-xl px-4 py-2 text-sm",
  sm: "rounded-lg px-3 py-1.5 text-xs",
};

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
}

export function ActionButton({
  variant = "primary",
  size = "md",
  className,
  style,
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "cursor-pointer font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-wait disabled:opacity-60",
        sizeClasses[size],
        className,
      )}
      style={{ ...variantStyles[variant], ...style }}
      {...props}
    />
  );
}
