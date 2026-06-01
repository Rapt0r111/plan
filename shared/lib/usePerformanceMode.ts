"use client";

import { useEffect, useState } from "react";
import { usePrefsStore } from "@/shared/store/usePrefsStore";

export function usePerformanceMode() {
  const animationLevel = usePrefsStore((s) => s.prefs.animationLevel);
  const showAmbientGlow = usePrefsStore((s) => s.prefs.showAmbientGlow);
  const showGrainTexture = usePrefsStore((s) => s.prefs.showGrainTexture);
  const glassIntensity = usePrefsStore((s) => s.prefs.glassIntensity);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const noMotion = animationLevel === "none" || prefersReducedMotion;
  const lowMotion = noMotion || animationLevel === "subtle";

  return {
    animationLevel,
    glassIntensity,
    showAmbientGlow,
    showGrainTexture,
    prefersReducedMotion,
    noMotion,
    lowMotion,
  };
}
