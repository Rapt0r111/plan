// features/zen-mode/ui/BreathingRing.tsx
"use client";
import { motion } from "framer-motion";

export function BreathingRing() {
  return (
    <motion.div
      className="absolute inset-0 rounded-2xl pointer-events-none"
      animate={{
        boxShadow: [
          "0 0 0 0px rgba(139,92,246,0.0)",
          "0 0 0 10px rgba(139,92,246,0.07)",
          "0 0 0 0px rgba(139,92,246,0.0)",
        ],
        borderColor: [
          "rgba(139,92,246,0.08)",
          "rgba(139,92,246,0.22)",
          "rgba(139,92,246,0.08)",
        ],
      }}
      style={{ border: "1px solid rgba(139,92,246,0.08)" }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}