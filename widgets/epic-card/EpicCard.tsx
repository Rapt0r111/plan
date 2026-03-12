"use client";
/**
 * @file EpicCard.tsx — widgets/epic-card
 *
 * ═══════════════════════════════════════════════
 * EPIC CARD — BIOLUMINESCENT MATTER v4 (2027)
 * ═══════════════════════════════════════════════
 *
 * Архитектурные решения:
 *
 *  LIQUID ORB — SVG feTurbulence + feDisplacementMap создают органическую
 *  поверхность жидкости. useSpring(stiffness:60) имитирует инерцию ртути.
 *  Три слоя: fill rect (жидкость), specular ellipse (блик), glow ring (ореол).
 *
 *  MESH GRADIENT — три radial-gradient с разными фокусными точками,
 *  одна из которых смещается при hover через CSS transition. Создаёт
 *  ощущение «живого» объёма без JS-анимации градиента.
 *
 *  KINETIC TYPOGRAPHY — useSpring на letterSpacing + fontVariationSettings.
 *  При приближении курсора к центру заголовка текст «растягивается».
 *
 *  LAYOUT PROJECTION — layoutId={`epic-${id}`} на корневом div.
 *  EpicWorkspace использует тот же layoutId — Framer автоматически
 *  вычисляет FLIP-анимацию между позициями.
 *
 *  СТЕКЛО 3 СЛОЯ:
 *   Layer 0 — bg-elevated base
 *   Layer 1 — glass-01 с blur(14px)
 *   Layer 2 — тонкая specular полоска сверху (rgba(255,255,255,0.06))
 */

import { useRef, useId, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { formatDate } from "@/shared/lib/utils";
import type { EpicSummary } from "@/shared/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function epicPhase(epic: EpicSummary): "dormant" | "active" | "complete" {
  if (epic.taskCount > 0 && epic.doneCount === epic.taskCount) return "complete";
  if (epic.startDate && new Date(epic.startDate) <= new Date()) return "active";
  return "dormant";
}

const PHASE_META = {
  dormant:  { label: "Планируется",  dot: "#64748b", glow: "rgba(100,116,139,0.18)", text: "#94a3b8" },
  active:   { label: "Активен",      dot: "#a78bfa", glow: "rgba(139,92,246,0.22)",  text: "#c4b5fd" },
  complete: { label: "Завершён",     dot: "#34d399", glow: "rgba(52,211,153,0.22)",  text: "#6ee7b7" },
} as const;

// ── Liquid Orb ────────────────────────────────────────────────────────────────

interface OrbProps {
  progress: number; // 0–1
  color: string;
  size?: number;
}

function LiquidOrb({ progress, color, size = 60 }: OrbProps) {
  const uid = useId().replace(/:/g, "");
  const R   = size * 0.43;
  const cx  = size / 2;

  // Physics-based fill: liquid inertia
  const rawY  = cx + R - 2 * R * progress;
  const fillY = useSpring(rawY, { stiffness: 55, damping: 14, mass: 1.2 });

  useEffect(() => {
    fillY.set(cx + R - 2 * R * progress);
  }, [progress, cx, R, fillY]);

  // Pulse ring opacity
  const pulseOpacity = useSpring(progress > 0 ? 0.45 : 0.1, { stiffness: 40, damping: 12 });

  const pct = Math.round(progress * 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Organic liquid wobble */}
        <filter id={`liq-${uid}`} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.028"
            numOctaves="3"
            seed="7"
            result="noise"
          >
            {/* Native SVG animation — zero JS cost */}
            <animate
              attributeName="baseFrequency"
              values="0.028;0.042;0.028"
              dur="4s"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={size * 0.065}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Sphere clip */}
        <clipPath id={`sph-${uid}`}>
          <circle cx={cx} cy={cx} r={R} />
        </clipPath>

        {/* Radial gradient for liquid depth */}
        <radialGradient id={`lgrad-${uid}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.0)" />
        </radialGradient>

        {/* Outer glow */}
        <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="transparent" />
          <stop offset="100%" stopColor={color} stopOpacity="0.35" />
        </radialGradient>
      </defs>

      {/* Outer ambient glow ring */}
      <motion.circle
        cx={cx} cy={cx} r={R + 5}
        fill={`url(#glow-${uid})`}
        style={{ opacity: pulseOpacity }}
      />

      {/* Pulse ring */}
      <motion.circle
        cx={cx} cy={cx} r={R + 2}
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{
          opacity: [0.15, 0.4, 0.15],
          scale: [0.97, 1.02, 0.97],
        }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Sphere dark base */}
      <circle cx={cx} cy={cx} r={R} fill={`${color}12`} />

      {/* Liquid fill — feTurbulence filter warps the rect surface */}
      <g clipPath={`url(#sph-${uid})`}>
        <motion.rect
          x={cx - R - 2}
          y={fillY}
          width={R * 2 + 4}
          height={R * 2 + size * 0.12}
          fill={color}
          opacity={0.72}
          filter={`url(#liq-${uid})`}
        />
        {/* Second lighter wave for depth */}
        <motion.rect
          x={cx - R - 2}
          y={fillY}
          width={R * 2 + 4}
          height={R * 0.25}
          fill={color}
          opacity={0.45}
          filter={`url(#liq-${uid})`}
          style={{ translateY: -4 }}
        />
      </g>

      {/* Radial gradient over liquid — depth illusion */}
      <circle cx={cx} cy={cx} r={R} fill={`url(#lgrad-${uid})`} />

      {/* Edge ring */}
      <circle
        cx={cx} cy={cx} r={R}
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        opacity={0.5}
      />
      <circle
        cx={cx} cy={cx} r={R}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.5"
      />

      {/* Specular highlight — angled oval */}
      <ellipse
        cx={cx * 0.74}
        cy={cx * 0.62}
        rx={R * 0.28}
        ry={R * 0.16}
        fill="rgba(255,255,255,0.22)"
        transform={`rotate(-20, ${cx * 0.74}, ${cx * 0.62})`}
      />

      {/* Secondary micro-highlight */}
      <ellipse
        cx={cx * 1.22}
        cy={cx * 0.52}
        rx={R * 0.08}
        ry={R * 0.05}
        fill="rgba(255,255,255,0.14)"
      />

      {/* Percentage label */}
      <text
        x={cx}
        y={cx + size * 0.06}
        textAnchor="middle"
        fontSize={size * 0.19}
        fontFamily="'DM Mono', monospace"
        fontWeight="600"
        fill="rgba(255,255,255,0.92)"
        style={{ textShadow: `0 0 8px ${color}` }}
      >
        {pct}%
      </text>
    </svg>
  );
}

// ── Mesh gradient background ─────────────────────────────────────────────────

function MeshBackground({ color, progress }: { color: string; progress: number }) {
  // Three animated orbs that shift based on progress
  const shift = progress * 30;
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `
          radial-gradient(ellipse 70% 55% at ${20 + shift * 0.3}% ${75 - shift * 0.2}%,
            ${color}1a 0%, transparent 55%),
          radial-gradient(ellipse 55% 45% at ${80 - shift * 0.2}% ${30 + shift * 0.15}%,
            ${color}10 0%, transparent 50%),
          radial-gradient(ellipse 40% 60% at 50% 110%,
            ${color}0d 0%, transparent 55%)
        `,
        transition: "background 1.2s ease",
      }}
    />
  );
}

// ── Card component ────────────────────────────────────────────────────────────

interface EpicCardProps {
  epic: EpicSummary;
  index?: number;
  onOpen: (epicId: number) => void;
}

export function EpicCard({ epic, index = 0, onOpen }: EpicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const progress = epic.taskCount > 0 ? epic.doneCount / epic.taskCount : 0;
  const pct      = Math.round(progress * 100);
  const phase    = epicPhase(epic);
  const meta     = PHASE_META[phase];

  // ── 3D Tilt ──────────────────────────────────────────────────────────────
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotX   = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), { stiffness: 260, damping: 30 });
  const rotY   = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), { stiffness: 260, damping: 30 });

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseX.set((e.clientX - r.left) / r.width  - 0.5);
    mouseY.set((e.clientY - r.top)  / r.height - 0.5);
  }

  function onMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  // ── Kinetic typography hover ─────────────────────────────────────────────
  const hoverProg = useMotionValue(0);
  const titleSpacing = useSpring(
    useTransform(hoverProg, [0, 1], ["normal", "0.018em"]),
    { stiffness: 180, damping: 24 }
  );

  return (
    <motion.div
      ref={cardRef}
      layoutId={`epic-card-${epic.id}`}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        layout: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.4, delay: index * 0.07 },
        y: { duration: 0.45, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] },
      }}
      style={{
        rotateX: rotX,
        rotateY: rotY,
        transformStyle: "preserve-3d",
        cursor: "pointer",
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onHoverStart={() => hoverProg.set(1)}
      onHoverEnd={() => hoverProg.set(0)}
      onClick={() => onOpen(epic.id)}
      whileHover={{ z: 12 }}
    >
      {/* ── Outer glow on hover ── */}
      <motion.div
        className="absolute -inset-px rounded-2xl pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        style={{
          background: `linear-gradient(135deg, ${epic.color}20 0%, transparent 60%)`,
          boxShadow: `0 0 0 0.5px ${epic.color}40, 0 12px 40px ${epic.color}18, 0 0 60px ${epic.color}0e`,
          borderRadius: 16,
        }}
      />

      {/* ── Glass card shell ── */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: "var(--bg-elevated)",
          border: `0.5px solid ${epic.color}30`,
          borderLeft: `2.5px solid ${epic.color}`,
          boxShadow: `
            0 0 0 0.5px rgba(255,255,255,0.04),
            0 2px 4px rgba(0,0,0,0.5),
            0 8px 24px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.05)
          `,
        }}
      >
        {/* Mesh gradient layer */}
        <MeshBackground color={epic.color} progress={progress} />

        {/* Top specular strip */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${epic.color}40 30%, rgba(255,255,255,0.12) 50%, ${epic.color}20 70%, transparent 100%)`,
          }}
        />

        {/* ── Content ── */}
        <div className="relative px-4 pt-4 pb-3 flex flex-col gap-3">

          {/* Row 1: phase badge + id */}
          <div className="flex items-center justify-between gap-2">
            <motion.div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{
                background: meta.glow,
                color: meta.text,
                borderColor: `${meta.dot}35`,
              }}
              layout
            >
              <motion.span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: meta.dot }}
                animate={
                  phase === "active"
                    ? { opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }
                    : { opacity: 1, scale: 1 }
                }
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              {meta.label}
            </motion.div>

            <span
              className="text-xs font-mono"
              style={{ color: "var(--text-muted)", opacity: 0.5 }}
            >
              #{epic.id}
            </span>
          </div>

          {/* Row 2: title (kinetic) + orb */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Kinetic title */}
              <motion.h3
                className="text-sm font-semibold leading-snug"
                style={{
                  color: "var(--text-primary)",
                  letterSpacing: titleSpacing as unknown as string,
                }}
              >
                {epic.title}
              </motion.h3>

              {epic.description && (
                <p
                  className="text-xs mt-1.5 line-clamp-2 leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {epic.description}
                </p>
              )}
            </div>

            {/* Liquid orb */}
            <div className="shrink-0" style={{ filter: `drop-shadow(0 0 10px ${epic.color}50)` }}>
              <LiquidOrb progress={progress} color={epic.color} size={58} />
            </div>
          </div>

          {/* Row 3: task stats + completion glow */}
          <div
            className="flex items-center justify-between pt-2"
            style={{ borderTop: `0.5px solid ${epic.color}20` }}
          >
            <div className="flex items-center gap-3">
              {/* Task counter */}
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: epic.color, opacity: 0.7 }}
                />
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: epic.color, fontWeight: 600 }}>{epic.doneCount}</span>
                  <span className="opacity-40">/{epic.taskCount}</span>
                  <span className="ml-1 opacity-50">задач</span>
                </span>
              </div>

              {/* Completion burst on 100% */}
              <AnimatePresence>
                {pct === 100 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.7, x: -4 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    className="text-xs"
                    style={{ color: meta.dot }}
                  >
                    ✦ Готово
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Date */}
            {epic.endDate && (
              <div className="flex items-center gap-1.5 opacity-60">
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  style={{ color: "var(--text-muted)" }}
                >
                  <rect x="1" y="2" width="10" height="9" rx="1.5" />
                  <path d="M4 1v2M8 1v2M1 5h10" />
                </svg>
                <span
                  className="text-xs font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatDate(epic.endDate)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom progress micro-bar ── */}
        <div style={{ height: 2, background: "rgba(255,255,255,0.04)" }}>
          <motion.div
            style={{
              height: "100%",
              backgroundColor: epic.color,
              boxShadow: `0 0 8px ${epic.color}80, 0 0 20px ${epic.color}30`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: index * 0.07 }}
          />
        </div>

        {/* ── Open affordance (bottom-right corner) ── */}
        <motion.div
          className="absolute bottom-2.5 right-3 flex items-center gap-1"
          initial={{ opacity: 0, x: 4 }}
          whileHover={{ opacity: 1, x: 0 }}
          style={{ color: epic.color, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-[10px] font-mono font-medium">раскрыть</span>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4.5 2H10v5.5M10 2L2 10" />
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
}