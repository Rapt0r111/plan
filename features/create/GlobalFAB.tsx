// features/create/GlobalFAB.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from "framer-motion";
import { CreateEpicModal } from "./CreateEpicModal";
import { CreateTaskModal } from "./CreateTaskModal";

const actions = [
  {
    id: "epic",
    label: "Новый эпик",
    sublabel: "Создать эпик",
    color: "#a78bfa",
    glow: "#7c3aed",
    bg: "rgba(109,40,217,0.15)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "task",
    label: "Новая задача",
    sublabel: "Добавить задачу",
    color: "#38bdf8",
    glow: "#0284c7",
    bg: "rgba(2,132,199,0.15)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Настройки",
    sublabel: "Параметры",
    color: "#fbbf24",
    glow: "#d97706",
    bg: "rgba(217,119,6,0.15)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
];

function ActionButton({ action, index, onAction }: { action: typeof actions[0]; index: number; onAction: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="flex items-center gap-3 justify-end"
      initial={{ opacity: 0, x: 40, scale: 0.7, filter: "blur(8px)" }}
      animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 30, scale: 0.75, filter: "blur(6px)" }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 30,
        delay: index * 0.06,
      }}
    >
      {/* Label pill */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: 8, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 6, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-end"
          >
            <span
              className="text-[13px] font-semibold leading-tight whitespace-nowrap px-3 py-1.5 rounded-xl"
              style={{
                color: action.color,
                background: action.bg,
                border: `1px solid ${action.color}30`,
                backdropFilter: "blur(16px)",
                boxShadow: `0 0 20px ${action.glow}20, inset 0 1px 0 rgba(255,255,255,0.08)`,
                fontFamily: "'SF Pro Display', system-ui, sans-serif",
                letterSpacing: "-0.01em",
              }}
            >
              {action.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Icon button */}
      <motion.button
        onClick={() => onAction(action.id)}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ color: action.color }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.88 }}
      >
        {/* Glass background */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${action.color}18 0%, ${action.bg} 100%)`,
            border: `1px solid ${action.color}35`,
            backdropFilter: "blur(20px)",
            boxShadow: hovered
              ? `0 0 32px ${action.glow}55, 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)`
              : `0 0 16px ${action.glow}22, 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)`,
            transition: "box-shadow 0.25s ease",
          }}
        />
        {/* Shimmer line */}
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${action.color}60, transparent)` }}
        />
        <span className="relative z-10">{action.icon}</span>
      </motion.button>
    </motion.div>
  );
}

function PulseRings({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {[0, 1].map(i => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-2xl"
          style={{ border: `1px solid ${color}`, borderRadius: 16 }}
          animate={{ scale: [1, 1.6, 1.6], opacity: [0.5, 0, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 1.2, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export function GlobalFAB() {
  const [open, setOpen] = useState(false);
  const [epicOpen, setEpicOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Magnetic effect
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const springX = useSpring(mx, { stiffness: 200, damping: 20 });
  const springY = useSpring(my, { stiffness: 200, damping: 20 });

  const handleMouse = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (open) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    mx.set((e.clientX - cx) * 0.35);
    my.set((e.clientY - cy) * 0.35);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClickOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOut);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOut);
    };
  }, []);

  const handleAction = (id: string) => {
    setOpen(false);
    if (id === "epic") setEpicOpen(true);
    else if (id === "task") setTaskOpen(true);
    else window.location.href = "/settings";
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[8999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              background: "radial-gradient(ellipse at bottom right, rgba(109,40,217,0.08) 0%, rgba(0,0,0,0.5) 70%)",
              backdropFilter: "blur(3px)",
            }}
          />
        )}
      </AnimatePresence>

      {/* FAB stack */}
      <div
        ref={ref}
        className="fixed z-[9000] flex flex-col items-end gap-2.5"
        style={{ bottom: 28, right: 28 }}
      >
        {/* Actions */}
        <AnimatePresence>
          {open &&
            actions.map((action, i) => (
              <ActionButton key={action.id} action={action} index={i} onAction={handleAction} />
            ))}
        </AnimatePresence>

        {/* Divider when open */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 0, opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="w-14 h-px self-center"
              style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.5), transparent)" }}
            />
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <div className="relative">
          {!open && <PulseRings color="rgba(139,92,246,0.6)" />}

          <motion.button
            onClick={() => {
              setOpen(v => !v);
              mx.set(0);
              my.set(0);
            }}
            onMouseMove={handleMouse}
            onMouseLeave={() => { mx.set(0); my.set(0); }}
            className="relative w-14  h-14 backdrop-blur rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ x: springX, y: springY }}
            whileTap={{ scale: 0.88 }}
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
          >
            {/* Multi-layer background */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: open
                  ? "linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.7) 100%)"
                  : "linear-gradient(135deg, rgba(109,40,217,0.95) 0%, rgba(124,58,237,0.8) 50%, rgba(139,92,246,0.7) 100%)",
                boxShadow: open
                  ? "0 0 40px rgba(239,68,68,0.6), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)"
                  : "0 0 40px rgba(109,40,217,0.7), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
                border: open ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(139,92,246,0.5)",
                transition: "all 0.35s ease",
              }}
            />
            {/* Top shimmer */}
            <div
              className="absolute top-0 left-2 right-2 h-px rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
              }}
            />
            {/* Inner noise texture illusion */}
            <motion.div
              className="absolute inset-0 rounded-2xl opacity-20"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              style={{
                background: "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.1) 25%, transparent 50%, rgba(255,255,255,0.05) 75%, transparent 100%)",
              }}
            />

            {/* Plus / X icon */}
            <motion.div className="relative z-10" animate={{ rotate: open ? 0 : 0 }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <motion.line
                  x1="11" y1="4" x2="11" y2="18"
                  stroke="white" strokeWidth="2.2" strokeLinecap="round"
                  animate={{ rotate: open ? 90 : 0, originX: "11px", originY: "11px" }}
                />
                <motion.line
                  x1="4" y1="11" x2="18" y2="11"
                  stroke="white" strokeWidth="2.2" strokeLinecap="round"
                />
              </svg>
            </motion.div>
          </motion.button>
        </div>
      </div>

      <CreateEpicModal open={epicOpen} onClose={() => setEpicOpen(false)} />
      <CreateTaskModal open={taskOpen} onClose={() => setTaskOpen(false)} />
    </>
  );
}