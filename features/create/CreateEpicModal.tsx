"use client";
/**
 * @file CreateEpicModal.tsx — features/create
 *
 * FIX v3: offline / network-error handling
 *   БЫЛО: fetch("/api/epics") без проверки типа ошибки.
 *         При ERR_INTERNET_DISCONNECTED (TypeError) ошибка поглощалась catch(e),
 *         setError(e.message) выдавал технический "Failed to fetch".
 *
 *   СТАЛО:
 *     - isNetworkError(e) определяет TypeError — сеть недоступна.
 *     - Показывается понятное сообщение "Нет соединения — попробуйте когда сеть восстановится."
 *     - Форма остаётся открытой, данные не теряются (setSaving(false) без onClose()).
 *
 *   ПРИМЕЧАНИЕ: Создание эпиков требует сервера (нет offline-queue для эпиков),
 *   поэтому мы не добавляем оптимистичный UI — только честное сообщение об ошибке.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const PRESET_COLORS = [
  "#8b5cf6", "#38bdf8", "#34d399", "#f59e0b",
  "#f87171", "#fb923c", "#a78bfa", "#2dd4bf",
  "#60a5fa", "#e879f9", "#4ade80", "#facc15",
];

function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError;
}

function EpicPreviewCard({
  title, description, color,
}: { title: string; description: string; color: string }) {
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderLeft: `3px solid ${color}`,
        backgroundImage: `radial-gradient(ellipse at top left, ${color}12 0%, transparent 50%)`,
      }}
    >
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border"
              style={{ background: `${color}18`, color, borderColor: `${color}35` }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              Планируется
            </span>
          </div>
          <h3
            className="font-semibold text-sm leading-snug truncate"
            style={{ color: title ? "var(--text-primary)" : "var(--text-muted)" }}
          >
            {title || "Название эпика..."}
          </h3>
          {description && (
            <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {description}
            </p>
          )}
        </div>
        <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90 shrink-0">
          <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle
            cx="22" cy="22" r="18" fill="none"
            stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 18}`}
            strokeDashoffset={`${2 * Math.PI * 18}`}
          />
          <text x="22" y="22" textAnchor="middle" dominantBaseline="central"
            fontSize="9" fontFamily="DM Mono, monospace" fontWeight="600"
            fill={color} transform="rotate(90 22 22)">
            0%
          </text>
        </svg>
      </div>
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--glass-border)" }}
      >
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          <span style={{ color, fontWeight: 600 }}>0</span>
          <span className="opacity-50">/0</span>
        </span>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>новый</span>
      </div>
    </div>
  );
}

export function CreateEpicModal({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setTitle(""); setDescription(""); setColor("#8b5cf6");
      setStartDate(""); setEndDate(""); setError(null);
    }
  }, [open]);

  const handleSave = useCallback(async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/epics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          color,
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Ошибка создания");

      onCreated?.();
      onClose();
      router.refresh();
    } catch (e) {
      // FIX v3: понятное сообщение при отсутствии сети
      if (isNetworkError(e)) {
        setError("Нет соединения — попробуйте когда сеть восстановится. Данные формы сохранены.");
        // Не закрываем форму — пользователь сохранит данные позже
      } else {
        setError(e instanceof Error ? e.message : "Ошибка");
      }
    } finally {
      setSaving(false);
    }
  }, [title, description, color, startDate, endDate, saving, onClose, onCreated, router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
  }, [onClose, handleSave]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-9500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            style={{ background: "var(--modal-backdrop)", backdropFilter: "blur(8px)" }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-0 z-9501 flex items-center justify-center p-4"
            style={{ pointerEvents: "none" }}
          >
            <motion.div
              className="w-full flex gap-6 items-start"
              style={{ maxWidth: 860, pointerEvents: "auto" }}
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              onKeyDown={handleKeyDown}
            >
              {/* Form panel */}
              <div
                className="flex-1 rounded-3xl overflow-hidden relative"
                style={{
                  background: "var(--modal-bg)",
                  border: `1px solid ${color}30`,
                  boxShadow: `0 0 0 1px ${color}15, 0 32px 80px rgba(0,0,0,0.7)`,
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent 0%, ${color} 30%, ${color} 70%, transparent 100%)` }} />
                <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}12 0%, transparent 65%)` }} />

                <div className="relative px-7 pt-7 pb-6 space-y-5">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: `${color}20`, border: `1px solid ${color}40`, boxShadow: `0 0 16px ${color}25` }}>
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round">
                          <circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 2" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Новый эпик</h2>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Группа задач объединённых общей целью</p>
                      </div>
                    </div>
                    <button onClick={onClose}
                      className="w-7 h-7 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
                      style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}>
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M2 2l8 8M10 2L2 10" />
                      </svg>
                    </button>
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="px-4 py-3 rounded-xl text-sm flex items-start gap-3"
                        style={{
                          background: error.includes("соединения")
                            ? "rgba(234,179,8,0.10)"
                            : "rgba(239,68,68,0.10)",
                          border: error.includes("соединения")
                            ? "1px solid rgba(234,179,8,0.25)"
                            : "1px solid rgba(239,68,68,0.25)",
                          color: error.includes("соединения") ? "#eab308" : "#f87171",
                        }}>
                        {error.includes("соединения") && (
                          <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M1 4h14M1 8h10M1 12h6" />
                          </svg>
                        )}
                        <span>{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Title */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "var(--text-muted)" }}>
                      Название *
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Например: Разработка мобильного приложения"
                      maxLength={120}
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                      style={{
                        background: "var(--glass-01)",
                        border: `1px solid ${title ? color + "50" : "var(--glass-border)"}`,
                        color: "var(--text-primary)",
                        caretColor: color,
                        boxShadow: title ? `0 0 0 3px ${color}10` : "none",
                      }}
                    />
                    <div className="flex justify-end mt-1">
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                        {title.length}/120
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "var(--text-muted)" }}>
                      Описание
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Что входит в этот эпик? Какова конечная цель?"
                      rows={3}
                      maxLength={500}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                      style={{
                        background: "var(--glass-01)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-secondary)",
                        caretColor: color,
                        fontFamily: "var(--font-sans)",
                      }}
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Дата начала", value: startDate, onChange: setStartDate },
                      { label: "Дата окончания", value: endDate, onChange: setEndDate },
                    ].map(({ label, value, onChange }) => (
                      <div key={label}>
                        <label className="text-xs font-semibold uppercase tracking-widest mb-2 block"
                          style={{ color: "var(--text-muted)" }}>
                          {label}
                        </label>
                        <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                          style={{
                            background: "var(--glass-01)",
                            border: "1px solid var(--glass-border)",
                            color: value ? "var(--text-primary)" : "var(--text-muted)",
                            colorScheme: "dark",
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Color */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-3 block"
                      style={{ color: "var(--text-muted)" }}>
                      Цвет эпика
                    </label>
                    <div className="flex items-center gap-3 flex-wrap">
                      {PRESET_COLORS.map((c) => (
                        <motion.button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className="relative w-7 h-7 rounded-xl"
                          style={{ backgroundColor: c }}
                          whileHover={{ scale: 1.2, y: -2 }}
                          whileTap={{ scale: 0.9 }}
                          animate={{
                            boxShadow: color === c
                              ? `0 0 0 2px var(--bg-base), 0 0 0 4px ${c}, 0 0 16px ${c}60`
                              : `0 2px 8px ${c}40`,
                            scale: color === c ? 1.1 : 1,
                          }}
                        >
                          {color === c && (
                            <motion.div
                              className="absolute inset-0 rounded-xl flex items-center justify-center"
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                            >
                              <svg className="w-3 h-3 text-white drop-shadow" viewBox="0 0 12 12"
                                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M2 6l3 3 5-5" />
                              </svg>
                            </motion.div>
                          )}
                        </motion.button>
                      ))}
                      <div className="relative">
                        <motion.label
                          className="w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer"
                          style={{ background: "var(--glass-02)", border: "1.5px dashed var(--glass-border)" }}
                          whileHover={{ scale: 1.1, borderColor: color }}
                          title="Свой цвет"
                        >
                          <input type="color" value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="opacity-0 absolute inset-0 cursor-pointer" />
                          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"
                            stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M6 1v10M1 6h10" />
                          </svg>
                        </motion.label>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)" }}>
                        ⌘↵
                      </kbd>
                      <span>создать</span>
                      <span className="opacity-30 mx-1">·</span>
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)" }}>
                        Esc
                      </kbd>
                      <span>отмена</span>
                    </div>
                    <div className="flex gap-2.5">
                      <motion.button type="button" onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-medium"
                        style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                        Отмена
                      </motion.button>
                      <motion.button type="button" onClick={handleSave}
                        disabled={!title.trim() || saving}
                        className="relative px-5 py-2 rounded-xl text-sm font-semibold overflow-hidden"
                        style={{
                          background: title.trim() ? `linear-gradient(135deg, ${color}30, ${color}18)` : "var(--glass-01)",
                          border: `1px solid ${title.trim() ? color + "50" : "var(--glass-border)"}`,
                          color: title.trim() ? color : "var(--text-muted)",
                          boxShadow: title.trim() ? `0 0 20px ${color}20` : "none",
                          opacity: saving ? 0.7 : 1,
                        }}
                        whileHover={title.trim() && !saving ? { scale: 1.03 } : {}}
                        whileTap={title.trim() && !saving ? { scale: 0.97 } : {}}>
                        {saving && (
                          <motion.div className="absolute inset-0"
                            style={{ background: `linear-gradient(90deg, transparent 30%, ${color}20 50%, transparent 70%)` }}
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{ duration: 0.9, repeat: Infinity }} />
                        )}
                        <span className="relative">{saving ? "Создаю..." : "Создать эпик"}</span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <motion.div
                className="w-72 shrink-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-1"
                  style={{ color: "var(--text-muted)" }}>
                  Предпросмотр
                </p>
                <EpicPreviewCard title={title} description={description} color={color} />
              </motion.div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}