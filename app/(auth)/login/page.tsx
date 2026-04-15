"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!login.trim() || !password) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login: login.trim(), password }),
        });

        const data = await res.json();

        if (!data.ok) {
          setError("Неверный логин или пароль");
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } catch {
        setError("Ошибка соединения. Попробуйте снова.");
      } finally {
        setLoading(false);
      }
    },
    [login, password, router]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl overflow-hidden"
      style={{
        background: "var(--modal-bg)",
        border: "1px solid var(--glass-border)",
        boxShadow:
          "0 0 0 1px rgba(139,92,246,0.08), 0 32px 80px rgba(0,0,0,0.6)",
      }}
    >
      {/* Top accent line */}
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--accent-400), transparent)",
        }}
      />

      <div className="px-8 pt-8 pb-8 space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--accent-500), var(--accent-400))",
              boxShadow: "0 0 20px var(--accent-glow)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.9" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Task<span style={{ color: "var(--accent-400)" }}>Flow</span>
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Войдите в систему
            </p>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-3 rounded-xl text-sm text-center"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#f87171",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Login */}
          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-widest block"
              style={{ color: "var(--text-muted)" }}
            >
              Логин
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="your.login"
              autoComplete="username"
              autoFocus
              required
              maxLength={64}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "var(--glass-01)",
                border: `1px solid ${login ? "rgba(139,92,246,0.4)" : "var(--glass-border)"}`,
                color: "var(--text-primary)",
                boxShadow: login ? "0 0 0 3px rgba(139,92,246,0.08)" : "none",
              }}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-widest block"
              style={{ color: "var(--text-muted)" }}
            >
              Пароль
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--glass-01)",
                  border: `1px solid ${password ? "rgba(139,92,246,0.4)" : "var(--glass-border)"}`,
                  color: "var(--text-primary)",
                  boxShadow: password ? "0 0 0 3px rgba(139,92,246,0.08)" : "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 1l14 14M6.5 6.6A3 3 0 0 0 9.4 9.5M3.2 3.3A7.5 7.5 0 0 0 1 8c1.3 2.9 4.1 5 7 5a7.4 7.4 0 0 0 3.7-1M5.5 2.7A7.4 7.4 0 0 1 8 2c2.9 0 5.7 2.1 7 5a7.6 7.6 0 0 1-1.8 2.5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 8c1.3-2.9 4.1-5 7-5s5.7 2.1 7 5c-1.3 2.9-4.1 5-7 5S2.3 10.9 1 8z" />
                    <circle cx="8" cy="8" r="2.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={!login.trim() || !password || loading}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all relative overflow-hidden"
            style={{
              background:
                login.trim() && password
                  ? "linear-gradient(135deg, var(--accent-500), var(--accent-400))"
                  : "var(--glass-01)",
              color:
                login.trim() && password ? "white" : "var(--text-muted)",
              border: `1px solid ${login.trim() && password ? "transparent" : "var(--glass-border)"}`,
              boxShadow:
                login.trim() && password
                  ? "0 0 24px var(--accent-glow)"
                  : "none",
              opacity: loading ? 0.7 : 1,
            }}
            whileHover={login.trim() && password && !loading ? { scale: 1.02 } : {}}
            whileTap={login.trim() && password && !loading ? { scale: 0.98 } : {}}
          >
            {loading && (
              <motion.div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                }}
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
            <span className="relative">{loading ? "Вход..." : "Войти"}</span>
          </motion.button>
        </form>

        {/* Register link */}
        <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-medium transition-colors"
            style={{ color: "var(--accent-400)" }}
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </motion.div>
  );
}