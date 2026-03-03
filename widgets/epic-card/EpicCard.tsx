"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import type { DbEpic } from "@/shared/types";
import { formatDate } from "@/shared/lib/utils";

interface Props {
  epic: DbEpic & { taskCount: number; doneCount: number };
  index?: number;
}

// Статусы — полностью в тёмной палитре дизайн-системы
const STATUS_CFG = {
  complete: {
    label: "Завершён",
    bg: "rgba(52,211,153,0.12)",
    text: "#34d399",
    border: "rgba(52,211,153,0.25)",
    dot: "#34d399",
  },
  active: {
    label: "Активен",
    bg: "rgba(139,92,246,0.12)",
    text: "#a78bfa",
    border: "rgba(139,92,246,0.25)",
    dot: "#a78bfa",
  },
  planned: {
    label: "Планируется",
    bg: "rgba(100,116,139,0.12)",
    text: "#94a3b8",
    border: "rgba(100,116,139,0.20)",
    dot: "#64748b",
  },
} as const;

function epicStatus(epic: DbEpic & { taskCount: number; doneCount: number }) {
  if (epic.taskCount > 0 && epic.doneCount === epic.taskCount) return "complete";
  if (epic.startDate && new Date(epic.startDate) <= new Date()) return "active";
  return "planned";
}

// SVG-кольцо прогресса
function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const R = 18;
  const C = 2 * Math.PI * R;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90 shrink-0">
      <circle cx="22" cy="22" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      <motion.circle
        cx="22" cy="22" r={R}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - pct / 100) }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
      />
      {/* Свечение */}
      <motion.circle
        cx="22" cy="22" r={R}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C, opacity: 0 }}
        animate={{ strokeDashoffset: C * (1 - pct / 100), opacity: 0.25 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        style={{ filter: `blur(3px)` }}
      />
      <text
        x="22" y="22"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fontFamily="DM Mono, monospace"
        fontWeight="600"
        fill={pct === 100 ? color : "rgba(255,255,255,0.7)"}
        transform="rotate(90 22 22)"
      >
        {pct}%
      </text>
    </svg>
  );
}

export function EpicCard({ epic, index = 0 }: Props) {
  const pct = epic.taskCount > 0 ? Math.round((epic.doneCount / epic.taskCount) * 100) : 0;
  const status = epicStatus(epic);
  const cfg = STATUS_CFG[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <Link
        href={`/epics/${epic.id}`}
        className="group relative block rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--glass-border)",
          borderLeft: `3px solid ${epic.color}`,
        }}
      >
        {/* Фоновый градиент от цвета эпика — усиливается при hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at top left, ${epic.color}12 0%, transparent 60%)`,
          }}
        />

        {/* Верхняя полоска — заголовок */}
        <div
          className="px-4 pt-4 pb-3 flex items-start justify-between gap-3"
          style={{
            background: `linear-gradient(135deg, ${epic.color}10 0%, transparent 50%)`,
          }}
        >
          <div className="flex-1 min-w-0">
            {/* Статус-бейдж */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border"
                style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
              >
                <motion.span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: cfg.dot }}
                  animate={status === "active" ? { opacity: [1, 0.3, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                {cfg.label}
              </span>
            </div>

            {/* Заголовок */}
            <h3
              className="font-semibold text-sm leading-snug transition-colors duration-200 truncate"
              style={{ color: "var(--text-primary)" }}
            >
              <span className="group-hover:text-[var(--accent-300)] transition-colors duration-200">
                {epic.title}
              </span>
            </h3>
          </div>

          {/* Кольцо прогресса */}
          <ProgressRing pct={pct} color={epic.color} />
        </div>

        {/* Описание */}
        {epic.description && (
          <p
            className="px-4 pb-3 text-xs leading-relaxed line-clamp-2"
            style={{ color: "var(--text-muted)" }}
          >
            {epic.description}
          </p>
        )}

        {/* Прогресс-бар */}
        <div className="px-4 pb-3">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: epic.color, boxShadow: `0 0 8px ${epic.color}80` }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            />
          </div>
        </div>

        {/* Футер */}
        <div
          className="px-4 py-2.5 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--glass-border)" }}
        >
          <div className="flex items-center gap-1.5">
            {/* Мини иконка задач */}
            <svg className="w-3 h-3 opacity-40" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 6h8M2 3h8M2 9h5" />
            </svg>
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: epic.color, fontWeight: 600 }}>{epic.doneCount}</span>
              <span className="opacity-50">/{epic.taskCount}</span>
            </span>
          </div>

          {epic.endDate && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 opacity-40" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="1" y="2" width="10" height="9" rx="1.5" />
                <path d="M4 1v2M8 1v2M1 5h10" />
              </svg>
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                до {formatDate(epic.endDate)}
              </span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}