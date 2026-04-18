"use client";
/**
 * @file SecurityTab.tsx — app/(main)/settings
 *
 * Вкладка «Безопасность»: смена собственного пароля.
 * Доступна всем авторизованным пользователям.
 *
 * После успешной смены пароля Better Auth завершает все другие сессии
 * (revokeOtherSessions: true), текущая сессия остаётся активной.
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Иконка глаза (показать/скрыть пароль) ────────────────────────────────────

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1 1l14 14M6.5 6.6A3 3 0 0 0 9.4 9.5M3.2 3.3A7.5 7.5 0 0 0 1 8c1.3 2.9 4.1 5 7 5a7.4 7.4 0 0 0 3.7-1M5.5 2.7A7.4 7.4 0 0 1 8 2c2.9 0 5.7 2.1 7 5a7.6 7.6 0 0 1-1.8 2.5" />
    </svg>
  ) : (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1 8c1.3-2.9 4.1-5 7-5s5.7 2.1 7 5c-1.3 2.9-4.1 5-7 5S2.3 10.9 1 8z" />
      <circle cx="8" cy="8" r="2.5" />
    </svg>
  );
}

// ── Поле ввода пароля ─────────────────────────────────────────────────────────

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  invalid?: boolean;
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder = "••••••••",
  autoComplete = "current-password",
  hint,
  invalid = false,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest block" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all"
          style={{
            background: "var(--glass-01)",
            border: `1px solid ${invalid ? "rgba(239,68,68,0.6)" : value ? "rgba(139,92,246,0.4)" : "var(--glass-border)"}`,
            color: "var(--text-primary)",
            boxShadow: invalid
              ? "0 0 0 3px rgba(239,68,68,0.08)"
              : value
                ? "0 0 0 3px rgba(139,92,246,0.08)"
                : "none",
          }}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg"
          style={{ color: "var(--text-muted)" }}
        >
          <EyeIcon visible={show} />
        </button>
      </div>
      {hint && (
        <p className="text-[11px]" style={{ color: invalid ? "#f87171" : "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────

export function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [success, setSuccess]                 = useState(false);

  const passwordMatch = !confirmPassword || newPassword === confirmPassword;
  const newPasswordTooShort = !!newPassword && newPassword.length < 8;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length > 0 &&
    passwordMatch &&
    !loading;

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json() as { ok: boolean; error?: string };

      if (!data.ok) {
        setError(data.error ?? "Ошибка смены пароля");
        return;
      }

      // Успех — очищаем поля и показываем уведомление
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Скрываем уведомление об успехе через 5 секунд
      setTimeout(() => setSuccess(false), 5000);
    } catch {
      setError("Ошибка соединения. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  }, [canSubmit, currentPassword, newPassword, confirmPassword]);

  return (
    <div className="max-w-md space-y-6">
      {/* Заголовок */}
      <div>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Безопасность
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Смена пароля завершит все другие активные сессии
        </p>
      </div>

      {/* Информационный блок: сессия истекает через 1 час */}
      <div
        className="px-4 py-3 rounded-xl flex items-start gap-3"
        style={{
          background: "rgba(139,92,246,0.08)",
          border: "1px solid rgba(139,92,246,0.2)",
        }}
      >
        <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3.5l2 2" />
        </svg>
        <div className="space-y-1">
          <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>
            Сессия истекает через 1 час
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            При активной работе срок автоматически продлевается. При бездействии дольше часа потребуется повторный вход.
          </p>
        </div>
      </div>

      {/* Форма смены пароля */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--glass-border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Сменить пароль
          </h3>
        </div>

        <div className="px-5 py-5">
          {/* Уведомления об ошибке / успехе */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "rgba(239,68,68,0.10)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#f87171",
                }}
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                style={{
                  background: "rgba(52,211,153,0.10)",
                  border: "1px solid rgba(52,211,153,0.25)",
                  color: "#34d399",
                }}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M2 8l4 4 8-8" />
                </svg>
                Пароль успешно изменён. Другие сессии завершены.
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="Текущий пароль"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
              placeholder="Ваш текущий пароль"
            />

            <PasswordField
              label="Новый пароль"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              placeholder="Не менее 8 символов"
              hint={newPasswordTooShort ? "Минимум 8 символов" : undefined}
              invalid={newPasswordTooShort}
            />

            <PasswordField
              label="Подтвердить новый пароль"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              placeholder="Повторите новый пароль"
              hint={!passwordMatch ? "Пароли не совпадают" : undefined}
              invalid={!passwordMatch}
            />

            <div className="pt-2">
              <motion.button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 rounded-xl text-sm font-semibold relative overflow-hidden"
                style={{
                  background: canSubmit
                    ? "linear-gradient(135deg, var(--accent-500), var(--accent-400))"
                    : "var(--glass-01)",
                  color: canSubmit ? "white" : "var(--text-muted)",
                  border: `1px solid ${canSubmit ? "transparent" : "var(--glass-border)"}`,
                  boxShadow: canSubmit ? "0 0 24px var(--accent-glow)" : "none",
                  opacity: loading ? 0.7 : 1,
                }}
                whileHover={canSubmit && !loading ? { scale: 1.02 } : {}}
                whileTap={canSubmit && !loading ? { scale: 0.98 } : {}}
              >
                {loading && (
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)" }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
                <span className="relative">
                  {loading ? "Сохраняю..." : "Сменить пароль"}
                </span>
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}