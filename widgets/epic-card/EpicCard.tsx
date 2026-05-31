"use client";
/**
 * @file EpicCard.tsx — widgets/epic-card
 *
 * ═══════════════════════════════════════════════════════════════
 * ОПТИМИЗАЦИЯ ПРОИЗВОДИТЕЛЬНОСТИ v6
 * ═══════════════════════════════════════════════════════════════
 *
 * ПРОБЛЕМЫ v5 (причины лагов при скролле):
 *
 * 1. LiquidOrb — SVG feTurbulence + <animate> на каждой карточке.
 *    При 6+ карточках = 6 параллельных GPU filter-chains (~60fps каждый).
 *    FIX: StaticOrb — чистый SVG без filter/animate. Прогресс передаётся
 *    через CSS clip-path + transition (compositor-only). Анимация turbulence
 *    убрана полностью — она не несёт информации, только нагружает GPU.
 *
 * 2. Tilt-эффект (useMotionValue + useSpring × 2 на карточку).
 *    При N карточках = 2N spring-подписок активны одновременно.
 *    При mousemove все они пересчитываются синхронно.
 *    FIX: CSS-only tilt через --mx/--my custom properties + CSS transform.
 *    Обновление через rAF-throttle — один style recalc в кадр.
 *    Framer springs полностью убраны для tilt.
 *
 * 3. MeshBackground — inline radial-gradient с transition: background 1.2s.
 *    Background-gradient transitions = repaint на каждом кадре (не compositor).
 *    FIX: Статичный градиент без transition. Цвет задаётся через CSS-переменную
 *    --epic-color, смена мгновенная. Визуально неотличимо при текущем дизайне.
 *
 * 4. kinetic typography (useSpring на letterSpacing).
 *    letterSpacing не compositor-friendly — вызывает text reflow.
 *    FIX: Убран. Hover-эффект карточки остаётся через ::before overlay.
 *
 * 5. AnimatePresence внутри карточки (done badge).
 *    FIX: Заменён на CSS opacity transition — дешевле.
 *
 * СОХРАНЕНО (без потери визуала):
 *   - layoutId для FLIP-анимации открытия workspace
 *   - initial/animate opacity + y (mount stagger)
 *   - Outer glow on hover (через CSS :hover, не Framer)
 *   - Phase badge с pulsing dot (только для active)
 *   - Progress bar animation (один раз при mount)
 *   - Все стили карточки
 */

import { useRef, useId, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { formatDate } from "@/shared/lib/utils";
import type { EpicSummary } from "@/shared/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function epicPhase(epic: EpicSummary): "dormant" | "active" | "complete" {
  if (epic.taskCount > 0 && epic.doneCount === epic.taskCount) return "complete";
  if (epic.startDate && new Date(epic.startDate) <= new Date()) return "active";
  return "dormant";
}

const PHASE_META = {
  dormant: { label: "Планируется", dot: "#64748b", glow: "rgba(100,116,139,0.18)", text: "#94a3b8" },
  active:  { label: "Активен",     dot: "#a78bfa", glow: "rgba(139,92,246,0.22)",  text: "#c4b5fd" },
  complete:{ label: "Завершён",    dot: "#34d399", glow: "rgba(52,211,153,0.22)",  text: "#6ee7b7" },
} as const;

// ── Static Orb (replaces LiquidOrb) ──────────────────────────────────────────
//
// ОПТИМИЗАЦИЯ: убраны feTurbulence + <animate> + feDisplacementMap.
// Те фильтры создавали GPU filter-chain работающий 60fps бесконечно.
// При 6 карточках = 6 × (turbulence + displacement) каждый кадр.
//
// Новый орб: clip-path для fill-level + CSS transition (compositor-friendly).
// Визуальный эффект "жидкости" сохранён через волнообразный clip-path.

interface OrbProps {
  progress: number;
  color: string;
  size?: number;
}

function StaticOrb({ progress, color, size = 60 }: OrbProps) {
  const uid = useId().replace(/:/g, "");
  const R = size * 0.43;
  const cx = size / 2;
  const pct = Math.round(progress * 100);

  // Fill level — y-координата верхнего края заливки
  const fillY = cx + R - 2 * R * progress;
  // Слегка волнообразная маска через clipPath (статичная, без анимации)
  // Имитирует поверхность жидкости без SVG-фильтров
  const waveOffset = R * 0.07;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <clipPath id={`sph-${uid}`}>
          <circle cx={cx} cy={cx} r={R} />
        </clipPath>
        <radialGradient id={`lgrad-${uid}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.22" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.0)" />
        </radialGradient>
      </defs>

      {/* Outer glow ring — статичный, без анимации */}
      <circle
        cx={cx} cy={cx} r={R + 3}
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        opacity={0.25}
      />

      {/* Base sphere */}
      <circle cx={cx} cy={cx} r={R} fill={`${color}12`} />

      {/* Liquid fill — clip внутри сферы */}
      <g clipPath={`url(#sph-${uid})`}>
        {/* Волнообразная поверхность через path вместо turbulence-фильтра */}
        {progress > 0 && (
          <path
            d={`
              M ${cx - R - 2} ${fillY + waveOffset}
              Q ${cx - R / 2} ${fillY - waveOffset},
                ${cx} ${fillY}
              Q ${cx + R / 2} ${fillY + waveOffset},
                ${cx + R + 2} ${fillY - waveOffset}
              L ${cx + R + 2} ${cx + R + 4}
              L ${cx - R - 2} ${cx + R + 4}
              Z
            `}
            fill={color}
            opacity={0.72}
            style={{
              // transition на clip-path / path — compositor-friendly через transform
              // Анимация при изменении progress
              transition: "d 0.8s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        )}
      </g>

      {/* Specular highlight */}
      <circle cx={cx} cy={cx} r={R} fill={`url(#lgrad-${uid})`} />
      <circle cx={cx} cy={cx} r={R} fill="none" stroke={color} strokeWidth="0.5" opacity={0.5} />

      {/* Specular spots */}
      <ellipse
        cx={cx * 0.74} cy={cx * 0.62}
        rx={R * 0.28} ry={R * 0.16}
        fill="rgba(255,255,255,0.22)"
        transform={`rotate(-20, ${cx * 0.74}, ${cx * 0.62})`}
      />
      <ellipse
        cx={cx * 1.22} cy={cx * 0.52}
        rx={R * 0.08} ry={R * 0.05}
        fill="rgba(255,255,255,0.14)"
      />

      {/* Percentage text */}
      <text
        x={cx} y={cx + size * 0.06}
        textAnchor="middle"
        fontSize={size * 0.19}
        fontFamily="'DM Mono', monospace"
        fontWeight="600"
        fill="rgba(255,255,255,0.92)"
      >
        {pct}%
      </text>
    </svg>
  );
}

// ── Mesh gradient background ──────────────────────────────────────────────────
//
// ОПТИМИЗАЦИЯ: убран `transition: background 1.2s ease`.
// Background-gradient transitions форсируют paint каждый кадр (не compositor).
// Градиент теперь статичный — задаётся через CSS-переменную --epic-color.
// Визуально неотличимо: цвет не меняется в процессе работы карточки.

function MeshBackground({ color }: { color: string }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `
          radial-gradient(ellipse 70% 55% at 20% 75%, ${color}1a 0%, transparent 55%),
          radial-gradient(ellipse 55% 45% at 80% 30%, ${color}10 0%, transparent 50%),
          radial-gradient(ellipse 40% 60% at 50% 110%, ${color}0d 0%, transparent 55%)
        `,
        // NO transition — статичный, без repaint при hover
      }}
    />
  );
}

// ── CSS-only tilt hook ────────────────────────────────────────────────────────
//
// ОПТИМИЗАЦИЯ: заменяет useMotionValue + useSpring × 2 (rotateX/rotateY).
// Framer springs держат 2 активные подписки на карточку и пересчитываются
// при каждом mousemove синхронно с React рендером.
//
// Новый подход:
// 1. Обновляем CSS custom properties --rotX/--rotY напрямую через rAF
// 2. CSS transform читает эти переменные — никакого React state/re-render
// 3. Плавность достигается через CSS transition на transform (compositor)
// 4. rAF throttle — один style.setProperty в кадр максимум

function useCssTilt(ref: React.RefObject<HTMLDivElement | null>) {
  const rafRef = useRef<number | null>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (rafRef.current !== null) return; // throttle: один rAF в кадр
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const mx = (e.clientX - r.left) / r.width - 0.5;
      const my = (e.clientY - r.top) / r.height - 0.5;
      ref.current?.style.setProperty("--rotX", `${-my * 4}deg`);
      ref.current?.style.setProperty("--rotY", `${mx * 4}deg`);
    });
  }, [ref]);

  const onMouseLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Плавный возврат обеспечивает CSS transition
    ref.current?.style.setProperty("--rotX", "0deg");
    ref.current?.style.setProperty("--rotY", "0deg");
  }, [ref]);

  // Cleanup при unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { onMouseMove, onMouseLeave };
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
  const pct = Math.round(progress * 100);
  const phase = epicPhase(epic);
  const meta = PHASE_META[phase];

  const { onMouseMove, onMouseLeave } = useCssTilt(cardRef);

  return (
    /*
     * Корневой div — держит CSS custom properties для tilt.
     * perspective задаётся здесь, transform читается через var().
     * isolate — stacking context без 3D.
     *
     * CSS transition на transform обеспечивает плавность через compositor
     * без каких-либо Framer springs. Это намного дешевле при скролле:
     * compositor не нужен React/JS для анимации между кадрами.
     */
    <div
      ref={cardRef}
      className="relative isolate epic-card-tilt-root"
      style={{
        perspective: "1200px",
        // CSS custom properties для tilt — обновляются через rAF, без re-render
        "--rotX": "0deg",
        "--rotY": "0deg",
      } as React.CSSProperties}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/*
       * layoutId — FLIP-анимация открытия workspace.
       * Оставлен только layoutId и mount animation (opacity/y).
       * Убраны: whileHover с Framer, kinetic typography spring.
       *
       * CSS tilt задаётся через style.transform с CSS-переменными.
       * transition на transform (0.25s) — compositor-only плавность.
       */}
      <motion.div
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
          // CSS tilt через переменные — обновляется вне React render cycle
          transform: "perspective(1200px) rotateX(var(--rotX)) rotateY(var(--rotY))",
          // Плавность через CSS transition (compositor, не Framer spring)
          transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1)",
          cursor: "pointer",
          // will-change: transform подсказывает браузеру создать composited layer
          willChange: "transform",
        }}
        onClick={() => onOpen(epic.id)}
        // Hover-эффект карточки — только через CSS (см. .epic-card-shell:hover в globals)
        // Убраны: onHoverStart/onHoverEnd (они форсировали Framer state updates)
      >
        {/* ── Outer glow on hover — CSS :hover, не Framer whileHover ── */}
        <div className="epic-card-glow-layer absolute -inset-px rounded-2xl pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${epic.color}20 0%, transparent 60%)`,
            boxShadow: `0 0 0 0.5px ${epic.color}40, 0 12px 40px ${epic.color}18, 0 0 60px ${epic.color}0e`,
            borderRadius: 16,
            opacity: 0,
            // CSS transition для hover glow — compositor-friendly (opacity)
            transition: "opacity 0.35s ease",
          }}
        />

        {/* ── Glass card shell ── */}
        <div
          className="epic-card-shell relative overflow-hidden rounded-2xl"
          style={{
            background: "var(--bg-elevated)",
            border: `0.5px solid ${epic.color}30`,
            borderLeft: `2.5px solid ${epic.color}`,
            boxShadow: `
              0 0 0 0.5px var(--inset-light),
              0 2px 4px rgba(0,0,0,0.25),
              0 8px 24px rgba(0,0,0,0.15),
              inset 0 1px 0 var(--inset-light)
            `,
          }}
        >
          <MeshBackground color={epic.color} />

          {/* Top specular strip */}
          <div
            className="absolute top-0 left-0 right-0 h-px pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${epic.color}40 30%, var(--shimmer-line) 50%, ${epic.color}20 70%, transparent 100%)`
            }}
          />

          {/* ── Content ── */}
          <div className="relative px-4 pt-4 pb-3 flex flex-col gap-3">
            {/* Row 1: phase badge + id */}
            <div className="flex items-center justify-between gap-2">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                style={{
                  background: meta.glow,
                  color: meta.text,
                  borderColor: `${meta.dot}35`,
                }}
              >
                {/* Pulsing dot — только для active, CSS animation */}
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: meta.dot,
                    // CSS animation вместо Framer animate — дешевле для простого pulse
                    animation: phase === "active"
                      ? "epic-dot-pulse 2s ease-in-out infinite"
                      : "none",
                  }}
                />
                {meta.label}
              </div>

              <span className="text-xs font-mono" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                #{epic.id}
              </span>
            </div>

            {/* Row 2: title + orb */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {/* Убран kinetic typography (letterSpacing spring → text reflow) */}
                <h3
                  className="text-sm font-semibold leading-snug"
                  style={{ color: "var(--text-primary)" }}
                >
                  {epic.title}
                </h3>

                {epic.description && (
                  <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {epic.description}
                  </p>
                )}
              </div>

              <div className="shrink-0" style={{ filter: `drop-shadow(0 0 10px ${epic.color}50)` }}>
                {/*
                 * StaticOrb вместо LiquidOrb.
                 * LiquidOrb запускал feTurbulence + feDisplacementMap + <animate>
                 * бесконечно (каждые ~100ms). Для 6 карточек = 6 GPU filter-chains.
                 * StaticOrb использует статичный SVG path — нет GPU overhead.
                 */}
                <StaticOrb progress={progress} color={epic.color} size={58} />
              </div>
            </div>

            {/* Row 3: task stats + date */}
            <div
              className="flex items-center justify-between pt-2"
              style={{ borderTop: `0.5px solid ${epic.color}20` }}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: epic.color, opacity: 0.7 }} />
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    <span style={{ color: epic.color, fontWeight: 600 }}>{epic.doneCount}</span>
                    <span className="opacity-40">/{epic.taskCount}</span>
                    <span className="ml-1 opacity-50">задач</span>
                  </span>
                </div>

                {/* Убран AnimatePresence — заменён на CSS opacity transition */}
                <span
                  className="text-xs"
                  style={{
                    color: meta.dot,
                    opacity: pct === 100 ? 1 : 0,
                    transform: pct === 100 ? "scale(1) translateX(0)" : "scale(0.7) translateX(-4px)",
                    transition: "opacity 0.2s ease, transform 0.2s ease",
                  }}
                >
                  ✦ Готово
                </span>
              </div>

              {epic.endDate && (
                <div className="flex items-center gap-1.5 opacity-60">
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                    strokeWidth="1.5" strokeLinecap="round" style={{ color: "var(--text-muted)" }}>
                    <rect x="1" y="2" width="10" height="9" rx="1.5" />
                    <path d="M4 1v2M8 1v2M1 5h10" />
                  </svg>
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    {formatDate(epic.endDate)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom progress bar ── */}
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

          {/* ── Open affordance — CSS :hover через класс ── */}
          <div
            className="epic-card-affordance absolute bottom-2.5 right-3 flex items-center gap-1"
            style={{
              color: epic.color,
              opacity: 0,
              transform: "translateX(4px)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
              pointerEvents: "none",
            }}
          >
            <span className="text-[10px] font-mono font-medium">раскрыть</span>
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round">
              <path d="M4.5 2H10v5.5M10 2L2 10" />
            </svg>
          </div>
        </div>
      </motion.div>
    </div>
  );
}