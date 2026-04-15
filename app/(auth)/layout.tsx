import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TaskFlow — Вход",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Ambient background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, hsla(262,83%,60%,0.08) 0%, transparent 60%)",
        }}
      />
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}