"use client";
/**
 * @file MagneticCheckbox.tsx — shared/ui
 *
 * 2026 UI primitive: a checkbox that magnetically follows the cursor
 * within its hover radius, then snaps back with spring physics.
 *
 * Features:
 *  - Magnetic pull: element floats toward cursor (max offset = size × 0.4)
 *  - Soft Pop: keyframe burst on check (scale 1 → 1.35 → 0.95 → 1)
 *  - Hover aura: radial gradient glow with accent color
 *  - Animated SVG checkmark with backOut entrance
 *  - Fully accessible: role="checkbox", aria-checked, keyboard-friendly
 */
import { useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";

interface MagneticCheckboxProps {
  checked: boolean;
  onChange: () => void;
  size?: "sm" | "md" | "lg";
  accentColor?: string;
  disabled?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 16, radius: 32, stroke: 1.5 },
  md: { box: 20, radius: 40, stroke: 1.8 },
  lg: { box: 24, radius: 52, stroke: 2 },
};

export function MagneticCheckbox({
  checked,
  onChange,
  size = "md",
  accentColor = "#8b5cf6",
  disabled = false,
  className = "",
}: MagneticCheckboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { box, radius, stroke } = SIZE_MAP[size];

  // Magnetic motion values
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tx = useSpring(mx, { stiffness: 280, damping: 18, mass: 0.6 });
  const ty = useSpring(my, { stiffness: 280, damping: 18, mass: 0.6 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius) {
      const pull = 1 - dist / radius;
      mx.set(dx * pull * 0.45);
      my.set(dy * pull * 0.45);
    }
  }, [disabled, mx, my, radius]);

  const handleMouseLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: box + 16, height: box + 16, cursor: disabled ? "not-allowed" : "pointer" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={disabled ? undefined : onChange}
      role="checkbox"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onChange();
        }
      }}
    >
      {/* Hover aura glow */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        initial={{ opacity: 0, scale: 0.6 }}
        whileHover={{ opacity: disabled ? 0 : 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        style={{
          background: `radial-gradient(circle, ${accentColor}30 0%, transparent 70%)`,
          width: box + 24,
          height: box + 24,
          left: -12,
          top: -12,
        }}
      />

      {/* The magnetic checkbox itself */}
      <motion.div
        style={{ x: tx, y: ty }}
        animate={checked
          ? { scale: [1, 1.35, 0.95, 1] }
          : { scale: 1 }
        }
        transition={checked
          // ИСправлено: используем keyframes для массива значений
          ? { type: "keyframes", times: [0, 0.4, 0.7, 1], duration: 0.4, ease: "easeInOut" }
          : { duration: 0.15 }
        }
      >
        <motion.div
          animate={{
            backgroundColor: checked ? accentColor : "rgba(255,255,255,0.04)",
            borderColor: checked ? accentColor : "rgba(255,255,255,0.18)",
            boxShadow: checked
              ? `0 0 12px ${accentColor}60, 0 0 4px ${accentColor}40`
              : "none",
          }}
          whileHover={!disabled && !checked ? {
            borderColor: accentColor,
            backgroundColor: `${accentColor}15`,
          } : {}}
          transition={{ duration: 0.15 }}
          style={{
            width: box,
            height: box,
            borderRadius: box * 0.28,
            border: "1.5px solid",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AnimatePresence>
            {checked && (
              <motion.svg
                key="check"
                initial={{ scale: 0, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
                width={box * 0.56}
                height={box * 0.56}
                viewBox="0 0 10 10"
                fill="none"
                stroke="white"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1.5 5l2.5 2.5 4.5-4.5" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}