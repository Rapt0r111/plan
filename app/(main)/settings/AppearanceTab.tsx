"use client";
/**
 * @file AppearanceTab.tsx — app/(main)/settings
 *
 * ВНЕШНИЙ ВИД И ПЕРСОНАЛИЗАЦИЯ
 * ════════════════════════════
 * Полная панель настроек UI:
 *  • Цветовой акцент (hue-picker + saturation)
 *  • Ширина сайдбара, плотность, масштаб шрифта
 *  • Карточки эпиков и задач
 *  • Параметры доски
 *  • Анимации, скругления, стекло
 *  • Живой предпросмотр в реальном времени
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    usePrefsStore,
    type UIPrefs,
    type Density,
    type AnimationLevel,
    type RadiusScale,
    type SidebarWidth,
    type CardSize,
    type GlassIntensity,
    type FontScale,
    type BoardColumnWidth,
} from "@/shared/store/usePrefsStore";

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(true);

    return (
        <motion.div
            layout
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
        >
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left group"
            >
                <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-glow)", border: "1px solid rgba(139,92,246,0.3)" }}
                >
                    {icon}
                </span>
                <span className="flex-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {title}
                </span>
                <motion.svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 16 16" fill="none" stroke="currentColor"
                    strokeWidth="1.8" strokeLinecap="round"
                    style={{ color: "var(--text-muted)" }}
                    animate={{ rotate: open ? 0 : -90 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                    <path d="M4 6l4 4 4-4" />
                </motion.svg>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: "hidden" }}
                    >
                        <div
                            className="px-5 pb-5 space-y-5"
                            style={{ borderTop: "1px solid var(--glass-border)" }}
                        >
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Row wrapper ───────────────────────────────────────────────────────────────

function Row({ label, hint, children }: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-4 pt-4">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
                {hint && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{hint}</p>
                )}
            </div>
            <div className="shrink-0 flex items-center gap-2">{children}</div>
        </div>
    );
}

// ── Chip selector ─────────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {options.map((opt) => {
                const active = opt.value === value;
                return (
                    <motion.button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        whileTap={{ scale: 0.95 }}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                        style={
                            active
                                ? {
                                    background: "var(--accent-glow)",
                                    color: "var(--accent-400)",
                                    border: "1px solid rgba(139,92,246,0.35)",
                                    boxShadow: "0 0 12px rgba(139,92,246,0.2)",
                                }
                                : {
                                    background: "var(--glass-01)",
                                    color: "var(--text-secondary)",
                                    border: "1px solid var(--glass-border)",
                                }
                        }
                    >
                        {opt.label}
                    </motion.button>
                );
            })}
        </div>
    );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <motion.button
            onClick={() => onChange(!value)}
            className="relative w-10 h-6 rounded-full shrink-0 transition-colors duration-200"
            style={{
                background: value ? "var(--accent-500)" : "var(--glass-03)",
                boxShadow: value ? "0 0 12px var(--accent-glow)" : "none",
            }}
            whileTap={{ scale: 0.95 }}
        >
            <motion.div
                className="absolute top-1 w-4 h-4 rounded-full bg-white"
                animate={{ left: value ? "calc(100% - 20px)" : "4px" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
            />
        </motion.button>
    );
}

// ── Hue picker ────────────────────────────────────────────────────────────────

function HuePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const PRESETS = [
        { hue: 262, name: "Аметист" },
        { hue: 196, name: "Сапфир" },
        { hue: 160, name: "Изумруд" },
        { hue: 30, name: "Янтарь" },
        { hue: 340, name: "Рубин" },
        { hue: 290, name: "Фуксия" },
        { hue: 220, name: "Индиго" },
        { hue: 90, name: "Лайм" },
    ];

    return (
        <div className="space-y-3">
            {/* Preset swatches */}
            <div className="flex gap-2 flex-wrap">
                {PRESETS.map((p) => {
                    const active = Math.abs(value - p.hue) < 5;
                    return (
                        <motion.button
                            key={p.hue}
                            onClick={() => onChange(p.hue)}
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.92 }}
                            title={p.name}
                            className="w-7 h-7 rounded-full transition-all"
                            style={{
                                background: `hsl(${p.hue}, 80%, 60%)`,
                                boxShadow: active
                                    ? `0 0 0 2px var(--bg-elevated), 0 0 0 4px hsl(${p.hue}, 80%, 60%), 0 0 12px hsl(${p.hue}, 80%, 60%)`
                                    : "none",
                            }}
                        />
                    );
                })}
            </div>

            {/* Fine-grained slider */}
            <div className="space-y-1">
                <div className="flex justify-between">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Оттенок</span>
                    <span
                        className="text-xs font-mono font-semibold"
                        style={{ color: `hsl(${value}, 80%, 65%)` }}
                    >
                        {value}°
                    </span>
                </div>
                <div className="relative h-4 flex items-center">
                    {/* Rainbow track */}
                    <div
                        className="absolute inset-y-0 left-0 right-0 rounded-full"
                        style={{
                            background: "linear-gradient(to right, hsl(0,80%,60%), hsl(60,80%,60%), hsl(120,80%,60%), hsl(180,80%,60%), hsl(240,80%,60%), hsl(300,80%,60%), hsl(360,80%,60%))",
                            top: "25%",
                            height: "50%",
                        }}
                    />
                    <input
                        type="range"
                        min={0}
                        max={360}
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="relative w-full appearance-none bg-transparent cursor-pointer"
                        style={{ height: "100%", accentColor: `hsl(${value}, 80%, 60%)` }}
                    />
                </div>
            </div>
        </div>
    );
}

// ── Saturation slider ─────────────────────────────────────────────────────────

function SaturationSlider({
    hue,
    value,
    onChange,
}: {
    hue: number;
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Насыщенность</span>
                <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: `hsl(${hue}, ${value}%, 65%)` }}
                >
                    {value}%
                </span>
            </div>
            <div className="relative h-4 flex items-center">
                <div
                    className="absolute left-0 right-0 rounded-full"
                    style={{
                        background: `linear-gradient(to right, hsl(${hue},20%,60%), hsl(${hue},100%,60%))`,
                        top: "25%",
                        height: "50%",
                    }}
                />
                <input
                    type="range"
                    min={40}
                    max={100}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="relative w-full appearance-none bg-transparent cursor-pointer"
                    style={{ height: "100%", accentColor: `hsl(${hue}, ${value}%, 60%)` }}
                />
            </div>
        </div>
    );
}

// ── Live preview card ─────────────────────────────────────────────────────────

function LivePreview({ prefs }: { prefs: UIPrefs }) {
    const accent = `hsl(${prefs.accentHue}, ${prefs.accentSaturation}%, 65%)`;
    const accentGlow = `hsla(${prefs.accentHue}, ${prefs.accentSaturation}%, 60%, 0.22)`;

    const RADIUS_MAP = { sharp: 6, default: 14, rounded: 20, pill: 28 };
    const r = RADIUS_MAP[prefs.radiusScale];

    const DENSITY_PAD = { compact: 8, comfortable: 12, spacious: 18 };
    const pad = DENSITY_PAD[prefs.density];

    const FONT_SCALE = { sm: 0.9, md: 1, lg: 1.1 };
    const fs = FONT_SCALE[prefs.fontScale];

    return (
        <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "var(--bg-overlay)", border: "1px solid var(--glass-border)" }}
        >
            <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Предпросмотр</span>
            </div>

            {/* Fake epic column header */}
            <div
                className="overflow-hidden"
                style={{
                    borderRadius: r,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                    borderLeft: `3px solid ${accent}`,
                }}
            >
                <div style={{ padding: pad }}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
                        <span
                            className="font-semibold"
                            style={{ fontSize: 13 * fs, color: "var(--text-primary)" }}
                        >
                            Март 2027
                        </span>
                        <span
                            className="ml-auto font-mono px-1.5 py-0.5 rounded-md"
                            style={{
                                fontSize: 10 * fs,
                                background: `${accent}18`,
                                color: accent,
                                borderRadius: r / 2,
                            }}
                        >
                            5
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div
                        className="h-1 rounded-full overflow-hidden mb-2"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                    >
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: "60%",
                                background: accent,
                                boxShadow: `0 0 6px ${accent}80`,
                            }}
                        />
                    </div>

                    {/* Fake task card */}
                    <div
                        style={{
                            borderRadius: r * 0.7,
                            background: "var(--bg-overlay)",
                            border: "1px solid var(--glass-border)",
                            padding: `${pad * 0.7}px ${pad}px`,
                        }}
                    >
                        <div className="flex items-center gap-2 mb-1.5">
                            <span
                                className="px-2 py-0.5 font-medium"
                                style={{
                                    fontSize: 10 * fs,
                                    borderRadius: 99,
                                    background: "rgba(56,189,248,0.14)",
                                    color: "#38bdf8",
                                }}
                            >
                                В работе
                            </span>
                            {prefs.showDueDates && (
                                <span className="ml-auto font-mono" style={{ fontSize: 10 * fs, color: "var(--text-muted)" }}>
                                    20 мар
                                </span>
                            )}
                        </div>
                        <p style={{ fontSize: 13 * fs, color: "var(--text-primary)", fontWeight: 500 }}>
                            Разработать API
                        </p>
                        {prefs.showTaskDescriptions && (
                            <p
                                className="mt-1 line-clamp-1"
                                style={{ fontSize: 11 * fs, color: "var(--text-muted)" }}
                            >
                                REST-эндпоинты для новых фич платформы
                            </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                            {prefs.showAssigneeAvatars && (
                                <div className="flex -space-x-1">
                                    {["АИ", "МК"].map((ini, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-center text-white font-bold"
                                            style={{
                                                width: 16 * fs,
                                                height: 16 * fs,
                                                fontSize: 7 * fs,
                                                borderRadius: 99,
                                                background: i === 0 ? accent : "#38bdf8",
                                                border: "1.5px solid var(--bg-overlay)",
                                            }}
                                        >
                                            {ini}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {prefs.showSubtaskProgress && (
                                <span className="font-mono" style={{ fontSize: 10 * fs, color: "var(--text-muted)" }}>
                                    3/5
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom add button */}
                <div style={{ padding: `${pad / 2}px ${pad}px`, borderTop: "1px solid var(--glass-border)" }}>
                    <span
                        className="flex items-center gap-1.5"
                        style={{
                            fontSize: 11 * fs,
                            color: "var(--text-muted)",
                            border: "1px dashed var(--glass-border)",
                            borderRadius: r * 0.6,
                            padding: "4px 10px",
                        }}
                    >
                        <span>+</span> Добавить задачу
                    </span>
                </div>
            </div>

            {/* Bottom accent button */}
            <div
                className="flex items-center gap-2 px-3 py-2 self-start w-fit"
                style={{
                    borderRadius: r,
                    background: accentGlow,
                    border: `1px solid ${accent}40`,
                    color: accent,
                    fontSize: 12 * fs,
                    fontWeight: 500,
                }}
            >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <rect x="1" y="1" width="4" height="4" rx="1" />
                    <rect x="7" y="1" width="4" height="4" rx="1" fillOpacity=".5" />
                    <rect x="1" y="7" width="4" height="4" rx="1" fillOpacity=".5" />
                    <rect x="7" y="7" width="4" height="4" rx="1" />
                </svg>
                Доска
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AppearanceTab() {
    const { prefs, set, reset } = usePrefsStore();
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    function p<K extends keyof UIPrefs>(key: K) {
        return (val: UIPrefs[K]) => set({ [key]: val });
    }

    const accent = `hsl(${prefs.accentHue}, ${prefs.accentSaturation}%, 65%)`;

    return (
        <div className="max-w-3xl space-y-4">

            {/* ── Header with live indicator ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        Персонализация интерфейса
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Настройки применяются мгновенно и сохраняются автоматически
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Live indicator */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                        style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
                        <motion.div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: "#34d399" }}
                            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <span className="text-xs font-medium" style={{ color: "#34d399" }}>Живой</span>
                    </div>

                    {/* Reset */}
                    <AnimatePresence mode="wait">
                        {showResetConfirm ? (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="flex items-center gap-1.5"
                            >
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Сбросить всё?</span>
                                <button
                                    onClick={() => { reset(); setShowResetConfirm(false); }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-medium"
                                    style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                                >
                                    Да
                                </button>
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className="px-2.5 py-1 rounded-lg text-xs"
                                    style={{ background: "var(--glass-02)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" }}
                                >
                                    Нет
                                </button>
                            </motion.div>
                        ) : (
                            <motion.button
                                key="btn"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowResetConfirm(true)}
                                className="px-3 py-1.5 rounded-xl text-xs transition-all"
                                style={{ background: "var(--glass-01)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" }}
                            >
                                Сбросить
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── LIVE PREVIEW ── */}
            <LivePreview prefs={prefs} />

            {/* ── ЦВЕТ И АКЦЕНТ ── */}
            <Section title="Цвет акцента" icon={
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 4v4l3 2" />
                </svg>
            }>
                <div className="pt-4 space-y-4">
                    <HuePicker value={prefs.accentHue} onChange={p("accentHue")} />
                    <SaturationSlider hue={prefs.accentHue} value={prefs.accentSaturation} onChange={p("accentSaturation")} />
                </div>
            </Section>

            {/* ── МАКЕТ ── */}
            <Section title="Макет и пространство" icon={
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="var(--accent-400)" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="1" y="1" width="14" height="14" rx="3" />
                    <path d="M5 1v14M1 7h14" />
                </svg>
            }>
                <Row label="Ширина сайдбара" hint="Влияет на ширину боковой панели">
                    <ChipGroup<SidebarWidth>
                        value={prefs.sidebarWidth}
                        options={[
                            { value: "narrow", label: "Узкий" },
                            { value: "default", label: "Стандарт" },
                            { value: "wide", label: "Широкий" },
                        ]}
                        onChange={p("sidebarWidth")}
                    />
                </Row>

                <Row label="Плотность" hint="Отступы вокруг элементов">
                    <ChipGroup<Density>
                        value={prefs.density}
                        options={[
                            { value: "compact", label: "Компактно" },
                            { value: "comfortable", label: "Удобно" },
                            { value: "spacious", label: "Просторно" },
                        ]}
                        onChange={p("density")}
                    />
                </Row>

                <Row label="Размер шрифта">
                    <ChipGroup<FontScale>
                        value={prefs.fontScale}
                        options={[
                            { value: "sm", label: "Мелкий" },
                            { value: "md", label: "Средний" },
                            { value: "lg", label: "Крупный" },
                        ]}
                        onChange={p("fontScale")}
                    />
                </Row>
            </Section>

            {/* ── КАРТОЧКИ ── */}
            <Section title="Карточки задач и эпиков" icon={
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="var(--accent-400)" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="1" y="3" width="14" height="10" rx="2.5" />
                    <path d="M4 7h8M4 10h5" />
                </svg>
            }>
                <Row label="Размер карточки эпика">
                    <ChipGroup<CardSize>
                        value={prefs.epicCardSize}
                        options={[
                            { value: "small", label: "Мал." },
                            { value: "default", label: "Стандарт" },
                            { value: "large", label: "Крупный" },
                        ]}
                        onChange={p("epicCardSize")}
                    />
                </Row>

                <Row label="Размер карточки задачи">
                    <ChipGroup<CardSize>
                        value={prefs.taskCardSize}
                        options={[
                            { value: "small", label: "Мал." },
                            { value: "default", label: "Стандарт" },
                            { value: "large", label: "Крупный" },
                        ]}
                        onChange={p("taskCardSize")}
                    />
                </Row>

                <Row label="Описание задачи" hint="Показывать краткое описание на карточке">
                    <Toggle value={prefs.showTaskDescriptions} onChange={p("showTaskDescriptions")} />
                </Row>

                <Row label="Аватары исполнителей" hint="Показывать мини-аватары на карточке">
                    <Toggle value={prefs.showAssigneeAvatars} onChange={p("showAssigneeAvatars")} />
                </Row>

                <Row label="Прогресс подзадач" hint="Кольцо/счётчик подзадач">
                    <Toggle value={prefs.showSubtaskProgress} onChange={p("showSubtaskProgress")} />
                </Row>

                <Row label="Дедлайны" hint="Показывать дату дедлайна на карточке">
                    <Toggle value={prefs.showDueDates} onChange={p("showDueDates")} />
                </Row>
            </Section>

            {/* ── ДОСКА ── */}
            <Section title="Доска" icon={
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="var(--accent-400)" fillOpacity=".8">
                    <rect x="1" y="1" width="4" height="14" rx="1.5" />
                    <rect x="6" y="1" width="4" height="9" rx="1.5" fillOpacity=".6" />
                    <rect x="11" y="1" width="4" height="11" rx="1.5" fillOpacity=".4" />
                </svg>
            }>
                <Row label="Ширина колонки эпика">
                    <ChipGroup<BoardColumnWidth>
                        value={prefs.boardColumnWidth}
                        options={[
                            { value: "narrow", label: "Узкая" },
                            { value: "default", label: "Стандарт" },
                            { value: "wide", label: "Широкая" },
                        ]}
                        onChange={p("boardColumnWidth")}
                    />
                </Row>

                <Row label="Свернуть эпики по умолч." hint="Начинать с collapsed состояния">
                    <Toggle value={prefs.epicColumnsCollapsed} onChange={p("epicColumnsCollapsed")} />
                </Row>

                <Row label="Статистика на доске" hint="Лента с метриками над доской">
                    <Toggle value={prefs.showBoardStats} onChange={p("showBoardStats")} />
                </Row>
            </Section>

            {/* ── ВИЗУАЛЬНЫЕ ── */}
            <Section title="Визуальные эффекты" icon={
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="var(--accent-400)" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M8 1l1.5 4.5H14L10 8.5l1.5 4.5L8 10.5 4.5 13 6 8.5 2 5.5h4.5z" />
                </svg>
            }>
                <Row label="Анимации" hint="Интенсивность переходов и эффектов">
                    <ChipGroup<AnimationLevel>
                        value={prefs.animationLevel}
                        options={[
                            { value: "none", label: "Нет" },
                            { value: "subtle", label: "Мягко" },
                            { value: "full", label: "Полные" },
                        ]}
                        onChange={p("animationLevel")}
                    />
                </Row>

                <Row label="Скругление" hint="Радиус скруглений у карточек и кнопок">
                    <ChipGroup<RadiusScale>
                        value={prefs.radiusScale}
                        options={[
                            { value: "sharp", label: "Острые" },
                            { value: "default", label: "Стандарт" },
                            { value: "rounded", label: "Мягкие" },
                            { value: "pill", label: "Круглые" },
                        ]}
                        onChange={p("radiusScale")}
                    />
                </Row>

                <Row label="Стекло (блюр)" hint="Прозрачность и размытие стеклянных поверхностей">
                    <ChipGroup<GlassIntensity>
                        value={prefs.glassIntensity}
                        options={[
                            { value: "solid", label: "Глухое" },
                            { value: "subtle", label: "Тонкое" },
                            { value: "default", label: "Стандарт" },
                            { value: "heavy", label: "Сильное" },
                        ]}
                        onChange={p("glassIntensity")}
                    />
                </Row>

                <Row label="Ambient glow" hint="Свечение курсора в фоне">
                    <Toggle value={prefs.showAmbientGlow} onChange={p("showAmbientGlow")} />
                </Row>

                <Row label="Шум/зернистость" hint="Субтильная текстура поверхностей (тёмная тема)">
                    <Toggle value={prefs.showGrainTexture} onChange={p("showGrainTexture")} />
                </Row>
            </Section>

            {/* ── Footer: current values summary ── */}
            <div
                className="px-4 py-3 rounded-xl font-mono text-xs flex flex-wrap gap-x-4 gap-y-1"
                style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
            >
                <span>акцент: <span style={{ color: accent }}>{prefs.accentHue}°</span></span>
                <span>плотность: {prefs.density}</span>
                <span>анимации: {prefs.animationLevel}</span>
                <span>скругления: {prefs.radiusScale}</span>
                <span>сайдбар: {prefs.sidebarWidth}</span>
                <span>шрифт: {prefs.fontScale}</span>
            </div>
        </div>
    );
}