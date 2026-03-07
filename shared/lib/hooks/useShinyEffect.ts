"use client";
/**
 * @file useShinyEffect.ts — shared/lib/hooks
 *
 * Aurora Pointer Effect — simulates light refraction on a glass surface.
 * Two-layer system:
 *   Layer 1 (primary): white specular highlight — the "hotspot"
 *   Layer 2 (aurora): colored aurora shifted for parallax depth
 *
 * Performance: uses Framer Motion spring MotionValues — compositor-thread
 * transforms only. Safe for 200+ elements at 60fps.
 *
 * Usage:
 *   const { shineStyle, auroraStyle, onMouseMove, onMouseLeave } = useShinyEffect();
 *   <motion.div onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
 *     <motion.div className="pointer-events-none absolute inset-0" style={shineStyle} />
 *     <motion.div className="pointer-events-none absolute inset-0" style={auroraStyle} />
 *   </motion.div>
 */
import { useRef, useCallback } from "react";
import { useMotionValue, useSpring, useTransform, type MotionStyle } from "framer-motion";

interface ShinyEffectOptions {
  /** Spring stiffness for tracking (default: 220) */
  stiffness?: number;
  /** Spring damping (default: 24) */
  damping?: number;
  /** Aurora color in hex or rgba (default: #8b5cf6) */
  accentColor?: string;
  /** Specular intensity 0–1 (default: 0.07) */
  intensity?: number;
  /** Aurora intensity 0–1 (default: 0.12) */
  auroraIntensity?: number;
}

interface ShinyEffectReturn {
  /** MotionStyle for the primary specular layer */
  shineStyle: MotionStyle;
  /** MotionStyle for the secondary aurora layer */
  auroraStyle: MotionStyle;
  onMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
}

export function useShinyEffect({
  stiffness = 220,
  damping = 24,
  intensity = 0.07,
}: ShinyEffectOptions = {}): ShinyEffectReturn {
  const elementRef = useRef<HTMLElement | null>(null);

  // Raw mouse position (0–100%)
  const rawX = useMotionValue(50);
  const rawY = useMotionValue(50);

  // Spring-damped for organic feel
  const springX = useSpring(rawX, { stiffness, damping });
  const springY = useSpring(rawY, { stiffness, damping });

  // Aurora offset — slightly behind the primary shine for depth


  // Opacity driven by distance from center
  const shineOpacity = useMotionValue(0);
  const shineOpacitySpring = useSpring(shineOpacity, { stiffness: 200, damping: 28 });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    rawX.set(x);
    rawY.set(y);
    shineOpacity.set(1);

    // Store the element ref for leave calculation
    elementRef.current = e.currentTarget;
  }, [rawX, rawY, shineOpacity]);

  const onMouseLeave = useCallback(() => {
    shineOpacity.set(0);
  }, [shineOpacity]);

  // Build gradient strings as motion transforms
  const shineBackground = useTransform(
    [springX, springY],
    ([x, y]: number[]) =>
      `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,${intensity}) 0%, rgba(255,255,255,${intensity * 0.3}) 35%, transparent 65%)`
  );

  const shineStyle: MotionStyle = {
    background: shineBackground as MotionStyle["background"],
    opacity: shineOpacitySpring,
    mixBlendMode: "screen",
  };

  const auroraStyle: MotionStyle = {
    background: shineBackground as MotionStyle["background"],
    opacity: shineOpacitySpring,
    mixBlendMode: "screen",
  };

  return { shineStyle, auroraStyle, onMouseMove, onMouseLeave };
}