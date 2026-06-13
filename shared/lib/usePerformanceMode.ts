"use client";

import { useSyncExternalStore } from "react";
import { usePrefsStore } from "@/shared/store/usePrefsStore";

type Listener = () => void;

const reducedMotionListeners = new Set<Listener>();
let reducedMotionQuery: MediaQueryList | null = null;

function getReducedMotionQuery(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  reducedMotionQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reducedMotionQuery;
}

function subscribeReducedMotion(listener: Listener): () => void {
  const query = getReducedMotionQuery();
  if (!query) return () => {};

  reducedMotionListeners.add(listener);
  if (reducedMotionListeners.size === 1) {
    query.addEventListener("change", notifyReducedMotionListeners);
  }

  return () => {
    reducedMotionListeners.delete(listener);
    if (reducedMotionListeners.size === 0) {
      query.removeEventListener("change", notifyReducedMotionListeners);
    }
  };
}

function notifyReducedMotionListeners(): void {
  reducedMotionListeners.forEach((listener) => listener());
}

function getReducedMotionSnapshot(): boolean {
  return getReducedMotionQuery()?.matches ?? false;
}

export function resolvePerformanceMode(animationLevel: "none" | "subtle" | "full", prefersReducedMotion: boolean) {
  const noMotion = animationLevel === "none" || prefersReducedMotion;
  return { noMotion, lowMotion: noMotion || animationLevel === "subtle" };
}

export function resolveMotionPolicy(animationLevel: "none" | "subtle" | "full") {
  return animationLevel === "full" ? "user" as const : "always" as const;
}

export function usePerformanceMode() {
  const prefs = usePrefsStore((s) => s.prefs);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const { animationLevel, glassIntensity, showAmbientGlow, showGrainTexture } = prefs;
  const { noMotion, lowMotion } = resolvePerformanceMode(animationLevel, prefersReducedMotion);

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
