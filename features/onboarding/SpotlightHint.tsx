// НОВЫЙ ФАЙЛ: features/onboarding/SpotlightHint.tsx
// Ненавязчивый "пульсирующий" маяк над элементом UI
"use client";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  visible: boolean;
  message: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function SpotlightHint({ visible, message, position = "bottom" }: Props) {
  const posMap = {
    top:    "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left:   "right-full mr-2 top-1/2 -translate-y-1/2",
    right:  "left-full ml-2 top-1/2 -translate-y-1/2",
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Пульсирующий маяк */}
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            animate={{ boxShadow: ["0 0 0 0 rgba(139,92,246,0.4)", "0 0 0 8px rgba(139,92,246,0)"] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          {/* Тултип */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`absolute z-50 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${posMap[position]}`}
            style={{
              background: "var(--modal-bg)",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "var(--accent-300)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            {message}
            <div
              className="absolute w-2 h-2 rotate-45"
              style={{
                background: "var(--modal-bg)",
                border: "1px solid rgba(139,92,246,0.3)",
                // позиционируется в зависимости от position через inline styles
              }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}