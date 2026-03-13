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
  }, [prefs]);

  return null;
}