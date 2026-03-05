/**
 * @file roleStyles.ts — shared/lib
 *
 * Единственное место, где hex → inline CSS styles.
 * Никаких Tailwind-классов не хранится в БД.
 *
 * КОНТРАКТ:
 *   backgroundColor: hex с 12% прозрачностью (20 в hex = 12%)
 *   borderColor:     hex с 27% прозрачностью (44 в hex)
 *   color:           hex (полный)
 *
 * Использование:
 *   <span style={hexToRoleStyles(role.hex)}>...</span>
 */
import type { CSSProperties } from "react";

export interface RoleStyles extends CSSProperties {
  backgroundColor: string;
  borderColor:     string;
  color:           string;
}

/**
 * hexToRoleStyles — вычисляет inline стили для роли из HEX-цвета.
 *
 * @param hex — цвет в формате #RRGGBB
 * @returns объект CSSProperties для передачи в style={}
 *
 * @example
 * const styles = hexToRoleStyles("#8b5cf6");
 * // { backgroundColor: "#8b5cf620", borderColor: "#8b5cf644", color: "#8b5cf6" }
 */
export function hexToRoleStyles(hex: string): RoleStyles {
  // Валидация + fallback
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#94a3b8";

  return {
    backgroundColor: `${safeHex}20`, // 12.5% opacity
    borderColor:     `${safeHex}44`, // 26.7% opacity
    color:           safeHex,
  };
}

/**
 * hexToGlowStyle — box-shadow glow для аватаров и акцентных элементов.
 */
export function hexToGlowStyle(hex: string, intensity: "sm" | "md" | "lg" = "md"): CSSProperties {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#94a3b8";
  const spread = { sm: "8px", md: "16px", lg: "28px" }[intensity];
  return {
    boxShadow: `0 0 ${spread} ${safeHex}40`,
  };
}