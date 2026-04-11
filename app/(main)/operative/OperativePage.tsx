"use client";
/**
 * @file OperativePage.tsx — app/(main)/operative
 *
 * Client Component: получает SSR-данные, гидрирует Zustand store,
 * рендерит сетку блоков по пользователям.
 *
 * ВАЖНО: новые пользователи подхватываются автоматически через router.refresh()
 * (SSE realtime push при изменениях в системе).
 */
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useOperativeStore } from "@/shared/store/useOperativeStore";
import { UserTaskBlock } from "@/widgets/operative/UserTaskBlock";
import type { UserWithOperativeTasks } from "@/entities/operative/operativeRepository";

interface Props {
  initialData: UserWithOperativeTasks[];
  isAdmin: boolean;
}

export function OperativePage({ initialData }: Props) {
  const hydrate    = useOperativeStore((s) => s.hydrate);
  const isHydrated = useOperativeStore((s) => s.isHydrated);
  const userBlocks = useOperativeStore((s) => s.userBlocks);

  // Гидрация при монтировании и при обновлении SSR-данных
  useEffect(() => {
    hydrate(initialData);
  }, [initialData, hydrate]);

  // Используем SSR-данные до гидрации стора (нет flash)
  const blocks = isHydrated ? userBlocks : initialData;

  if (blocks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-full py-32 text-center"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: "var(--glass-02)",
            border:     "1px solid var(--glass-border)",
          }}
        >
          <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="16" cy="10" r="5" />
            <path d="M6 28a10 10 0 0 1 20 0" />
          </svg>
        </div>
        <p className="text-base font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
          Нет пользователей
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Добавьте пользователей в разделе{" "}
          <a href="/settings" className="underline" style={{ color: "var(--accent-400)" }}>
            Настройки → Пользователи
          </a>
        </p>
      </motion.div>
    );
  }

  return (
    <div
      className="p-6 grid gap-5"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
        alignItems: "start",
      }}
    >
      {blocks.map((block, idx) => (
        <motion.div
          key={block.user.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          <UserTaskBlock block={block} />
        </motion.div>
      ))}
    </div>
  );
}