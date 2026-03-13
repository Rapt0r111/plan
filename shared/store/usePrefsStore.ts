/**
 * @file usePrefsStore.ts — shared/store
 *
 * UI PREFERENCES STORE
 * ════════════════════
 * Persisted to localStorage. Applied to CSS custom properties via PrefsApplicator.
 * All values are serialisable primitives — no DOM references.
 *
 * Each key maps 1-to-1 to a CSS variable that downstream components
 * consume. This way NO component needs to import this store — they
 * just use the variable. Only PrefsApplicator reads this store.
 */
"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Types ──────────────────────────────────────────────────────────────────

export type Density = "compact" | "comfortable" | "spacious";
export type AnimationLevel = "none" | "subtle" | "full";
export type RadiusScale = "sharp" | "default" | "rounded" | "pill";
export type SidebarWidth = "narrow" | "default" | "wide";
export type CardSize = "small" | "default" | "large";
export type GlassIntensity = "solid" | "subtle" | "default" | "heavy";
export type FontScale = "sm" | "md" | "lg";
export type BoardColumnWidth = "narrow" | "default" | "wide";

export interface UIPrefs {
  // ── Accent ──────────────────────────────────────────────────────────────
  accentHue: number;           // 0–360, default 262 (amethyst)
  accentSaturation: number;    // 50–100

  // ── Layout ──────────────────────────────────────────────────────────────
  sidebarWidth: SidebarWidth;
  density: Density;            // global spacing scale
  fontScale: FontScale;        // text size multiplier

  // ── Cards ───────────────────────────────────────────────────────────────
  epicCardSize: CardSize;
  taskCardSize: CardSize;
  showTaskDescriptions: boolean;
  showAssigneeAvatars: boolean;
  showSubtaskProgress: boolean;
  showDueDates: boolean;

  // ── Board ───────────────────────────────────────────────────────────────
  boardColumnWidth: BoardColumnWidth;
  epicColumnsCollapsed: boolean;  // default collapsed state for EpicColumn
  showBoardStats: boolean;

  // ── Visual ──────────────────────────────────────────────────────────────
  animationLevel: AnimationLevel;
  radiusScale: RadiusScale;
  glassIntensity: GlassIntensity;
  showAmbientGlow: boolean;
  showGrainTexture: boolean;
}

export const DEFAULT_PREFS: UIPrefs = {
  accentHue: 262,
  accentSaturation: 83,

  sidebarWidth: "default",
  density: "comfortable",
  fontScale: "md",

  epicCardSize: "default",
  taskCardSize: "default",
  showTaskDescriptions: true,
  showAssigneeAvatars: true,
  showSubtaskProgress: true,
  showDueDates: true,

  boardColumnWidth: "default",
  epicColumnsCollapsed: true,
  showBoardStats: true,

  animationLevel: "full",
  radiusScale: "default",
  glassIntensity: "default",
  showAmbientGlow: true,
  showGrainTexture: true,
};

// ── CSS variable mappings ──────────────────────────────────────────────────

export function prefsToCSSVars(prefs: UIPrefs): Record<string, string> {
  const SIDEBAR_W = { narrow: "180px", default: "220px", wide: "268px" };
  const DENSITY_GAP = { compact: "8px", comfortable: "12px", spacious: "20px" };
  const DENSITY_PAD = { compact: "10px", comfortable: "14px", spacious: "20px" };
  const DENSITY_CARD_PAD = { compact: "8px 10px", comfortable: "10px 14px", spacious: "14px 18px" };
  const FONT_SCALE = { sm: "0.9", md: "1", lg: "1.1" };
  const RADIUS = { sharp: "6px", default: "14px", rounded: "20px", pill: "28px" };
  const RADIUS_SM = { sharp: "4px", default: "8px", rounded: "12px", pill: "16px" };
  const RADIUS_LG = { sharp: "10px", default: "20px", rounded: "28px", pill: "40px" };
  const GLASS_BG = {
    solid:   "rgba(15,17,33,0.98)",
    subtle:  "rgba(15,17,33,0.80)",
    default: "rgba(10,11,21,0.92)",
    heavy:   "rgba(6,7,13,0.70)",
  };
  const BOARD_COL = { narrow: "320px", default: "420px", wide: "520px" };
  const ANIM_DURATION = { none: "0ms", subtle: "150ms", full: "300ms" };
  const CARD_SCALE = { small: "0.93", default: "1", large: "1.06" };

  return {
    "--sidebar-w":            SIDEBAR_W[prefs.sidebarWidth],
    "--prefs-gap":            DENSITY_GAP[prefs.density],
    "--prefs-pad":            DENSITY_PAD[prefs.density],
    "--prefs-card-pad":       DENSITY_CARD_PAD[prefs.density],
    "--prefs-font-scale":     FONT_SCALE[prefs.fontScale],
    "--radius":               RADIUS[prefs.radiusScale],
    "--radius-sm":            RADIUS_SM[prefs.radiusScale],
    "--radius-lg":            RADIUS_LG[prefs.radiusScale],
    "--modal-bg":             GLASS_BG[prefs.glassIntensity],
    "--prefs-board-col-w":    BOARD_COL[prefs.boardColumnWidth],
    "--prefs-anim-duration":  ANIM_DURATION[prefs.animationLevel],
    "--prefs-epic-scale":     CARD_SCALE[prefs.epicCardSize],
    "--prefs-task-scale":     CARD_SCALE[prefs.taskCardSize],
    "--accent-h":             String(prefs.accentHue),
    "--accent-s":             `${prefs.accentSaturation}%`,
    "--prefs-grain-opacity":  prefs.showGrainTexture ? "0.022" : "0",
    "--prefs-glow-opacity":   prefs.showAmbientGlow ? "1" : "0",
  };
}

// ── Store ──────────────────────────────────────────────────────────────────

interface PrefsStore {
  prefs: UIPrefs;
  set: (patch: Partial<UIPrefs>) => void;
  reset: () => void;
}

export const usePrefsStore = create<PrefsStore>()(
  persist(
    (set) => ({
      prefs: DEFAULT_PREFS,

      set: (patch) =>
        set((s) => ({ prefs: { ...s.prefs, ...patch } })),

      reset: () => set({ prefs: DEFAULT_PREFS }),
    }),
    {
      name: "ui-prefs-v1",
      // Only persist the prefs object, not the actions
      partialize: (s) => ({ prefs: s.prefs }),
    },
  ),
);