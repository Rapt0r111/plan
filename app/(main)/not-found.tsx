// ✅ СОЗДАТЬ: app/(main)/not-found.tsx
import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-4xl font-bold font-mono" style={{ color: "var(--accent-400)" }}>404</p>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Страница не найдена</p>
      <Link href="/dashboard" className="text-xs text-(--accent-400) hover:underline">
        На главную
      </Link>
    </div>
  );
}