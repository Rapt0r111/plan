"use client";
/**
 * @file page.tsx — app/(auth)/login
 *
 * Login form using better-auth email+password strategy.
 * Redirects to /dashboard (or callbackUrl param) on success.
 * Shows a role indicator after successful auth.
 */

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signIn } from "@/shared/lib/auth-client";
import { Suspense } from "react";

// ── Inner form (needs useSearchParams → must be inside Suspense) ──────────────
function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams?.get("callbackUrl") ?? "/dashboard";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showPw,   setShowPw]   = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      const result = await signIn.email({
        email: email.trim().toLowerCase(),
        password,
        callbackURL: callbackUrl,
      });

      if (result?.error) {
        setError("Неверный email или пароль. Попробуйте ещё раз.");
        return;
      }

      // Better-auth redirects automatically via callbackURL,
      // but we do a manual push as a fallback.
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Ошибка подключения. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  }, [email, password, callbackUrl, router]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-sm"
    >
      {/* Card */}
      <div
        className="rounded-3xl overflow-hidden relative"
        style={{
          background: "var(--modal-bg)",
          border:     "1px solid var(--glass-border)",
          boxShadow:  "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)",
        }}
      >
        {/* Accent top line */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, #8b5cf6, transparent)" }}
        />

        {/* Ambient glow */}
        <div
          className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 70%)" }}
        />

        <div className="relative px-8 pt-8 pb-7 space-y-6">
          {/* Logo + title */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(109,40,217,0.9), rgba(139,92,246,0.7))",
                boxShadow:  "0 0 28px rgba(139,92,246,0.55)",
                border:     "1px solid rgba(139,92,246,0.5)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="1"  y="1"  width="8" height="8" rx="2" fill="white" fillOpacity="0.9" />
                <rect x="13" y="1"  width="8" height="8" rx="2" fill="white" fillOpacity="0.5" />
                <rect x="1"  y="13" width="8" height="8" rx="2" fill="white" fillOpacity="0.5" />
                <rect x="13" y="13" width="8" height="8" rx="2" fill="white" fillOpacity="0.9" />
              </svg>
            </div>

            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Task<span style={{ color: "#a78bfa" }}>Flow</span>
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Войдите в систему управления задачами
              </p>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "rgba(239,68,68,0.10)",
                  border:     "1px solid rgba(239,68,68,0.28)",
                  color:      "#f87171",
                }}
              >
                <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3M8 11v.01" />
                </svg>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all disabled:opacity-50"
                style={{
                  background:  "var(--glass-01)",
                  border:      `1px solid ${email ? "rgba(139,92,246,0.4)" : "var(--glass-border)"}`,
                  color:       "var(--text-primary)",
                  caretColor:  "#8b5cf6",
                  boxShadow:   email ? "0 0 0 3px rgba(139,92,246,0.08)" : "none",
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all disabled:opacity-50"
                  style={{
                    background: "var(--glass-01)",
                    border:     `1px solid ${password ? "rgba(139,92,246,0.4)" : "var(--glass-border)"}`,
                    color:      "var(--text-primary)",
                    caretColor: "#8b5cf6",
                    boxShadow:  password ? "0 0 0 3px rgba(139,92,246,0.08)" : "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  {showPw ? (
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                      <circle cx="8" cy="8" r="2"/>
                      <path d="M2 2l12 12"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                      <circle cx="8" cy="8" r="2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="relative w-full py-3 rounded-xl text-sm font-semibold overflow-hidden transition-all"
              style={{
                background: email.trim() && password
                  ? "linear-gradient(135deg, rgba(109,40,217,0.9), rgba(139,92,246,0.8))"
                  : "var(--glass-02)",
                border: `1px solid ${email.trim() && password ? "rgba(139,92,246,0.5)" : "var(--glass-border)"}`,
                color: email.trim() && password ? "white" : "var(--text-muted)",
                boxShadow: email.trim() && password ? "0 0 24px rgba(139,92,246,0.4)" : "none",
                opacity: loading ? 0.7 : 1,
              }}
              whileHover={email.trim() && password && !loading ? { scale: 1.01 } : {}}
              whileTap={email.trim() && password && !loading ? { scale: 0.98 } : {}}
            >
              {loading && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)" }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              )}
              <span className="relative">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      style={{ display: "inline-block" }}
                    />
                    Вход...
                  </span>
                ) : "Войти"}
              </span>
            </motion.button>
          </form>

          {/* Role hint */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background:  "var(--glass-01)",
              border:      "1px solid var(--glass-border)",
            }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 14 14" fill="none"
              stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round">
              <circle cx="7" cy="5" r="2.5" />
              <path d="M1.5 12.5a5.5 5.5 0 0 1 11 0" />
            </svg>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              <span className="font-semibold" style={{ color: "#a78bfa" }}>Администратор</span>
              {" "}— полный доступ.{" "}
              <span className="font-semibold" style={{ color: "#94a3b8" }}>Участник</span>
              {" "}— только просмотр и смена статуса.
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs mt-5" style={{ color: "var(--text-muted)" }}>
        TaskFlow · Система управления задачами
      </p>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="w-full max-w-sm h-96 rounded-3xl animate-pulse"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
        />
      }
    >
      <LoginForm />
    </Suspense>
  );
}