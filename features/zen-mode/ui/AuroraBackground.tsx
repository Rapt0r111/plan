// features/zen-mode/ui/AuroraBackground.tsx
"use client";
import { motion } from "framer-motion";

export function AuroraBackground() {
  return (
    // was: background: "#000000" — now adapts: deep cosmos in dark, milky in light
    <div className="absolute inset-0 overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <motion.div
        className="absolute"
        style={{
          inset: "-20%",
          background: "radial-gradient(ellipse 60% 40% at 30% 40%, rgba(139,92,246,0.12) 0%, transparent 70%)",
          willChange: "transform",
        }}
        animate={{ scale: [1, 1.08, 1], x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute"
        style={{
          inset: "-20%",
          background: "radial-gradient(ellipse 50% 35% at 70% 60%, rgba(56,189,248,0.07) 0%, transparent 65%)",
          willChange: "transform",
        }}
        animate={{ scale: [1, 1.12, 1], x: [0, -25, 0], y: [0, 20, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute"
        style={{
          inset: "-20%",
          background: "radial-gradient(ellipse 45% 30% at 50% 80%, rgba(52,211,153,0.05) 0%, transparent 60%)",
          willChange: "transform",
        }}
        animate={{ scale: [1, 1.06, 1], x: [0, 15, -10, 0], y: [0, 10, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />
    </div>
  );
}