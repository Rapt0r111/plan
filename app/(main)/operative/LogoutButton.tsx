"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all"
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.2)",
        color: "#f87171",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
      title="Выйти"
    >
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M4 2H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2M7 9l3-3-3-3M10 6H3" />
      </svg>
      {loading ? "..." : "Выйти"}
    </button>
  );
}