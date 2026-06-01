"use client";
/**
 * @file PrefsApplicator.tsx — shared/ui
 *
 * Reads UIPrefs from the store and applies them as CSS custom properties
 * on <html>. Runs only on the client (useEffect). Zero render output.
 *
 * Mount once at the top of the layout tree.
 */
import { useEffect } from "react";
import { usePrefsStore, prefsToCSSVars } from "@/shared/store/usePrefsStore";

export function PrefsApplicator() {
  const prefs = usePrefsStore((s) => s.prefs);

  useEffect(() => {
    const vars = prefsToCSSVars(prefs);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v);
    }

    root.dataset.animationLevel = prefs.animationLevel;
    root.dataset.glassIntensity = prefs.glassIntensity;
    root.dataset.showAmbientGlow = String(prefs.showAmbientGlow);
    root.dataset.showGrainTexture = String(prefs.showGrainTexture);
  }, [prefs]);

  return null;
}
