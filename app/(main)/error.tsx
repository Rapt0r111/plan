// ✅ СОЗДАТЬ: app/(main)/error.tsx
"use client";
import { useEffect } from "react";

export default function Error({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-sm text-[var(--text-secondary)]">Что-то пошло не так</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-xl text-xs font-medium"
        style={{ background: "var(--accent-glow)", color: "var(--accent-400)",
          border: "1px solid rgba(139,92,246,0.3)" }}
      >
        Попробовать снова
      </button>
    </div>
  );
}