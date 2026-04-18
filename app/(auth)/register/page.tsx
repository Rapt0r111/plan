"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function RegisterPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordMatch = !passwordConfirm || password === passwordConfirm;

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!login.trim() || !password) return;

      if (password !== passwordConfirm) {
        setError("Пароли не совпадают");
        return;
      }
      if (password.length < 8) {
        setError("Пароль должен содержать не менее 8 символов");
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(login.trim())) {
        setError("Логин может содержать только латинские буквы, цифры, _, ., -");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login: login.trim(),
            password,
            name: name.trim() || login.trim(),
          }),
        });

        const data = await res.json();

        if (!data.ok) {
          const msg = String(data.error ?? "");
          if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("already")) {
            setError("Этот логин уже занят");
          } else {
            setError("Ошибка регистрации. Проверьте данные.");
          }
          return;
        }

        // ИСПРАВЛЕНИЕ: register route теперь сам выдаёт Set-Cookie (auto-login на сервере).
        // Отдельный fetch к /api/auth/login больше не нужен — cookie уже установлен.
        router.push("/dashboard");
        router.refresh();
      } catch {
        setError("Ошибка соединения. Попробуйте снова.");
      } finally {
        setLoading(false);
      }
    },
    [login, name, password, passwordConfirm, router]
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
              background:
                "linear-gradient(135deg, var(--accent-500), var(--accent-400))",
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
              Создать аккаунт
            </p>
          </div>
        </div>

        {/* First user notice */}
        <div
          className="px-3 py-2.5 rounded-xl text-xs text-center"
          style={{
            background: "rgba(139,92,246,0.08)",
            border: "1px solid rgba(139,92,246,0.2)",
            color: "var(--accent-400)",
          }}
        >
          Первый зарегистрированный пользователь получает права администратора
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
              Логин *
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="ivan.petrov"
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
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Только латинские буквы, цифры, _, ., -
            </p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-widest block"
              style={{ color: "var(--text-muted)" }}
            >
              Имя
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иван Петров (опционально)"
              autoComplete="name"
              maxLength={120}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "var(--glass-01)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-widest block"
              style={{ color: "var(--text-muted)" }}
            >
              Пароль *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Не менее 8 символов"
                autoComplete="new-password"
                required
                minLength={8}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg"
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

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-widest block"
              style={{ color: "var(--text-muted)" }}
            >
              Подтвердить пароль *
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Повторите пароль"
              autoComplete="new-password"
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "var(--glass-01)",
                border: `1px solid ${
                  !passwordMatch
                    ? "rgba(239,68,68,0.6)"
                    : passwordConfirm
                      ? "rgba(52,211,153,0.4)"
                      : "var(--glass-border)"
                }`,
                color: "var(--text-primary)",
                boxShadow: !passwordMatch
                  ? "0 0 0 3px rgba(239,68,68,0.08)"
                  : passwordConfirm
                    ? "0 0 0 3px rgba(52,211,153,0.08)"
                    : "none",
              }}
            />
            {!passwordMatch && (
              <p className="text-[11px]" style={{ color: "#f87171" }}>
                Пароли не совпадают
              </p>
            )}
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={!login.trim() || !password || !passwordConfirm || !passwordMatch || loading}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all relative overflow-hidden"
            style={{
              background:
                login.trim() && password && passwordConfirm && passwordMatch
                  ? "linear-gradient(135deg, var(--accent-500), var(--accent-400))"
                  : "var(--glass-01)",
              color:
                login.trim() && password && passwordConfirm && passwordMatch
                  ? "white"
                  : "var(--text-muted)",
              border: `1px solid ${
                login.trim() && password && passwordConfirm && passwordMatch
                  ? "transparent"
                  : "var(--glass-border)"
              }`,
              boxShadow:
                login.trim() && password && passwordConfirm && passwordMatch
                  ? "0 0 24px var(--accent-glow)"
                  : "none",
              opacity: loading ? 0.7 : 1,
            }}
            whileHover={
              login.trim() && password && passwordConfirm && passwordMatch && !loading
                ? { scale: 1.02 }
                : {}
            }
            whileTap={
              login.trim() && password && passwordConfirm && passwordMatch && !loading
                ? { scale: 0.98 }
                : {}
            }
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
            <span className="relative">
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </span>
          </motion.button>
        </form>

        {/* Login link */}
        <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Уже есть аккаунт?{" "}
          <Link
            href="/login"
            className="font-medium transition-colors"
            style={{ color: "var(--accent-400)" }}
          >
            Войти
          </Link>
        </p>
      </div>
    </motion.div>
  );
}