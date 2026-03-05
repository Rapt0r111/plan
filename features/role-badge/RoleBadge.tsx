/**
 * @file RoleBadge.tsx — features/role-badge
 *
 * ИЗМЕНЕНИЯ: bgClass/textClass/borderClass удалены из RoleMeta.
 * Используем hexToRoleStyles() для inline стилей.
 */
import { hexToRoleStyles } from "@/shared/lib/roleStyles";
import type { RoleMeta } from "@/shared/types";

interface Props {
  roleMeta:  RoleMeta;
  size?:     "sm" | "md";
  showLabel?: boolean;
}

export function RoleBadge({ roleMeta, size = "md", showLabel = true }: Props) {
  const styles = hexToRoleStyles(roleMeta.hex);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      }`}
      style={styles}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: roleMeta.hex }}
      />
      {showLabel && roleMeta.label}
    </span>
  );
}