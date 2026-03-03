import type { RoleMeta } from "@/shared/config/roles";
import { cn } from "@/shared/lib/utils";

interface Props {
  roleMeta: RoleMeta;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function RoleBadge({ roleMeta, size = "md", showLabel = true }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium border",
        roleMeta.bgClass,
        roleMeta.textClass,
        roleMeta.borderClass,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: roleMeta.hex }}
      />
      {showLabel && roleMeta.label}
    </span>
  );
}