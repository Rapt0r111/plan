"use client";

import { MotionConfig } from "framer-motion";
import { resolveMotionPolicy } from "@/shared/lib/usePerformanceMode";
import { usePrefsStore } from "@/shared/store/usePrefsStore";

export function PerformanceMotionConfig({ children }: { children: React.ReactNode }) {
  const animationLevel = usePrefsStore((state) => state.prefs.animationLevel);

  return (
    <MotionConfig reducedMotion={resolveMotionPolicy(animationLevel)}>
      {children}
    </MotionConfig>
  );
}
