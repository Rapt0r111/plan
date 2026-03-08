// НОВЫЙ КОМПОНЕНТ: shared/ui/AnimatedCounter.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface Props {
  value: number;
  className?: string;
}

export function AnimatedCounter({ value, className }: Props) {
  // Храним предыдущее значение и направление в стейте
  const [state, setState] = useState({ prev: value, direction: 1 });

  // Рекомендованный React способ получения производного состояния из пропсов.
  // Это не вызовет бесконечного цикла, так как скрыто за условием.
  // React прервет текущий рендер и сразу запустит новый с актуальными данными.
  if (value !== state.prev) {
    setState({
      prev: value,
      direction: value > state.prev ? 1 : -1,
    });
  }

  return (
    <span className={`relative inline-block overflow-hidden ${className}`} style={{ lineHeight: 1 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: state.direction * -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: state.direction * 16, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}