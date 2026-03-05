// features/zen-mode/ui/ZenComplete.tsx
"use client";
import { motion } from "framer-motion";

interface Props { onDeactivate: () => void; completed: number; }

export function ZenComplete({ onDeactivate, completed }: Props) {
  const noun = completed === 1 ? "задача" : completed < 5 ? "задачи" : "задач";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="text-center space-y-6"
    >
      <motion.div
        className="text-5xl"
        animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 1.2, delay: 0.3, ease: "easeInOut" }}
      >
        ✦
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
          {completed > 0 ? `Выполнено ${completed}` : "Всё выполнено"}
        </h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
          {completed > 0 ? `${noun} за сессию` : "Очередь задач пуста"}
        </p>
      </div>

      <button
        onClick={onDeactivate}
        className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{
          background: "rgba(139,92,246,0.14)",
          border: "1px solid rgba(139,92,246,0.28)",
          color: "#a78bfa",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        Вернуться к доске
      </button>
    </motion.div>
  );
}