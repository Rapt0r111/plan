"use client";
/**
 * @file CommandPalette.tsx — features/command-palette
 *
 * ═══════════════════════════════════════════════════════════════
 * THE COGNITIVE ACCELERATOR
 * ═══════════════════════════════════════════════════════════════
 *
 * ИЗМЕНЕНИЯ В ЭТОЙ ВЕРСИИ (Этап 7):
 *  + Добавлены Zen Mode команды в категорию "action"
 *  + useZenStore интегрирован для активации Zen Mode
 *  + buildZenCommands() вызывается внутри useMemo
 *
 * Остальная архитектура без изменений — см. оригинальный файл.
 */

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useId,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useCommandPaletteStore } from "./useCommandPaletteStore";
import { useKeyboardShortcuts } from "@/shared/lib/hooks/useKeyboardShortcuts";
import { ROLE_META } from "@/shared/config/roles";
import { useZenStore } from "@/features/zen-mode/useZenStore";
import { buildZenCommands } from "@/features/zen-mode/zenCommands";
import type { Role } from "@/shared/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type CommandCategory = "navigation" | "epic" | "action" | "team";

interface CommandItem {
  id: string;
  category: CommandCategory;
  label: string;
  description?: string;
  icon: string;
  color?: string;
  onSelect: () => void;
  keywords?: string[];
}

// ─── Fuzzy Scoring ────────────────────────────────────────────────────────────

function scoreFuzzy(query: string, item: CommandItem): number {
  if (!query) return 100;
  const q = query.toLowerCase().trim();
  const label = item.label.toLowerCase();
  const desc = (item.description ?? "").toLowerCase();
  const keywords = (item.keywords ?? []).join(" ").toLowerCase();
  const haystack = `${label} ${desc} ${keywords}`;

  if (label.startsWith(q)) return 95 + (q.length / label.length) * 5;
  if (label.includes(q)) return 70 + (q.length / label.length) * 10;
  if (haystack.includes(q)) return 45;

  function trigrams(s: string): Set<string> {
    const set = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) set.add(s.slice(i, i + 3));
    return set;
  }
  const qt = trigrams(q);
  const lt = trigrams(label);
  const inter = [...qt].filter((t) => lt.has(t)).length;
  const union = new Set([...qt, ...lt]).size;
  const jaccard = union > 0 ? inter / union : 0;
  return jaccard > 0.1 ? Math.round(jaccard * 35) : 0;
}

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORY_ORDER: CommandCategory[] = ["navigation", "epic", "action", "team"];

const CATEGORY_LABEL: Record<CommandCategory, string> = {
  navigation: "Навигация",
  epic: "Эпики",
  action: "Действия",
  team: "Команда",
};

// ─── Icon Renderer ────────────────────────────────────────────────────────────

function CommandIcon({ icon, color }: { icon: string; color?: string }) {
  const isEmoji = /\p{Emoji}/u.test(icon);
  if (isEmoji) {
    return (
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
        style={{ backgroundColor: color ? `${color}22` : "var(--glass-02)" }}
      >
        {icon}
      </span>
    );
  }
  return (
    <span
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{
        backgroundColor: color ? `${color}22` : "var(--glass-02)",
        border: color ? `1px solid ${color}30` : "1px solid var(--glass-border)",
      }}
    >
      <span className="text-xs font-bold" style={{ color: color ?? "var(--text-muted)" }}>
        {icon}
      </span>
    </span>
  );
}

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="px-1.5 py-0.5 rounded text-[10px] font-mono"
      style={{
        background: "var(--glass-02)",
        border: "1px solid var(--glass-border)",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </kbd>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter();
  const { isOpen, initialQuery, close } = useCommandPaletteStore();
  const { open: openPalette } = useCommandPaletteStore();

  const epics = useTaskStore((s) => s.epics);

  // ── Zen Mode integration ───────────────────────────────────────────────────
  const { activate: activateZen, setQueue: setZenQueue } = useZenStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen, initialQuery]);

  useKeyboardShortcuts([
    {
      key: "k",
      meta: true,
      handler: () => (isOpen ? close() : openPalette()),
    },
  ]);

  // ── Command list ───────────────────────────────────────────────────────────
  const commands = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      {
        id: "nav-dashboard",
        category: "navigation",
        label: "Перейти на обзор",
        description: "Главная страница с эпиками и командой",
        icon: "📊",
        keywords: ["dashboard", "главная", "обзор", "home"],
        onSelect: () => { router.push("/dashboard"); close(); },
      },
      {
        id: "nav-board",
        category: "navigation",
        label: "Открыть доску",
        description: "Spatial Canvas — все задачи по эпикам",
        icon: "🗂️",
        keywords: ["board", "доска", "задачи", "kanban"],
        onSelect: () => { router.push("/board"); close(); },
      },
    ];

    const epicCmds: CommandItem[] = epics.map((epic) => ({
      id: `epic-${epic.id}`,
      category: "epic" as CommandCategory,
      label: epic.title,
      description: `${epic.progress.done}/${epic.progress.total} задач · ${
        epic.progress.total > 0
          ? Math.round((epic.progress.done / epic.progress.total) * 100)
          : 0
      }%`,
      icon: "📋",
      color: epic.color,
      keywords: ["эпик", "epic", epic.title],
      onSelect: () => { router.push(`/epics/${epic.id}`); close(); },
    }));

    const roleCmds: CommandItem[] = Object.values(ROLE_META).map((meta) => ({
      id: `role-${meta.role}`,
      category: "team" as CommandCategory,
      label: meta.label,
      description: "Фильтровать задачи по роли → Доска",
      icon: meta.label.slice(0, 2),
      color: meta.hex,
      keywords: [meta.role, "роль", "фильтр", "команда"],
      onSelect: () => { router.push("/board"); close(); },
    }));

    // ── Zen Mode commands (buildZenCommands) ─────────────────────────────────
    const pendingTasks = epics.flatMap((e) =>
      e.tasks.filter((t) => t.status !== "done")
    );
    const urgentTasks = pendingTasks.filter(
      (t) => t.priority === "critical" || t.priority === "high"
    );

    const zenCmds: CommandItem[] = [
      {
        id: "zen-activate-all",
        category: "action",
        label: "Войти в Zen Mode",
        description: `${pendingTasks.length} незавершённых задач`,
        icon: "◈",
        color: "#a78bfa",
        keywords: ["zen", "фокус", "поток", "focus", "mode", "концентрация"],
        onSelect: () => {
          setZenQueue(pendingTasks);
          activateZen();
          close();
        },
      },
    ];

    if (urgentTasks.length > 0) {
      zenCmds.push({
        id: "zen-activate-urgent",
        category: "action",
        label: "Zen Mode: Критические задачи",
        description: `${urgentTasks.length} задач с высоким приоритетом`,
        icon: "◈",
        color: "#f87171",
        keywords: ["zen", "критично", "срочно", "urgent", "critical"],
        onSelect: () => {
          setZenQueue(urgentTasks);
          activateZen();
          close();
        },
      });
    }
    // ── /Zen Mode commands ───────────────────────────────────────────────────

    const actions: CommandItem[] = [
      ...zenCmds,
      {
        id: "action-sync",
        category: "action",
        label: "Обновить данные",
        description: "Принудительная синхронизация с базой данных",
        icon: "🔄",
        keywords: ["refresh", "sync", "обновить", "перезагрузить"],
        onSelect: () => { router.refresh(); close(); },
      },
      {
        id: "action-board-filter-todo",
        category: "action",
        label: "Показать: К работе",
        description: "Открыть доску с фильтром статуса",
        icon: "⏳",
        color: "#64748b",
        keywords: ["todo", "к работе", "фильтр", "статус"],
        onSelect: () => { router.push("/board"); close(); },
      },
      {
        id: "action-board-filter-blocked",
        category: "action",
        label: "Показать: Заблокировано",
        description: "Найти все заблокированные задачи",
        icon: "🚫",
        color: "#f87171",
        keywords: ["blocked", "заблокировано", "проблема"],
        onSelect: () => { router.push("/board"); close(); },
      },
      {
        id: "action-board-filter-done",
        category: "action",
        label: "Показать: Завершённые",
        description: "Только выполненные задачи",
        icon: "✅",
        color: "#34d399",
        keywords: ["done", "готово", "завершено", "выполнено"],
        onSelect: () => { router.push("/board"); close(); },
      },
    ];

    return [...nav, ...epicCmds, ...roleCmds, ...actions];
  }, [epics, router, close, activateZen, setZenQueue]);

  // ── Filtered + grouped results ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((cmd) => ({ cmd, score: scoreFuzzy(query, cmd) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd);
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map<CommandCategory, CommandItem[]>();
    for (const cat of CATEGORY_ORDER) {
      const items = filtered.filter((c) => c.category === cat);
      if (items.length) map.set(cat, items);
    }
    return map;
  }, [filtered]);

  const flatList = useMemo(
    () => [...grouped.values()].flat(),
    [grouped]
  );

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(flatList.length - 1, 0)));
  }, [flatList.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % flatList.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + flatList.length) % flatList.length);
      }
      if (e.key === "Enter" && flatList[selectedIndex]) {
        flatList[selectedIndex].onSelect();
      }
    },
    [close, flatList, selectedIndex]
  );

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50"
            style={{ backdropFilter: "blur(12px)", background: "rgba(8,9,15,0.65)" }}
            onClick={close}
            aria-hidden="true"
          />

          <motion.div
            key="cp-panel"
            role="dialog"
            aria-label="Command palette"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed left-1/2 top-[18%] z-50 w-full max-w-[640px] -translate-x-1/2 flex flex-col overflow-hidden"
            style={{
              borderRadius: "20px",
              background: "rgba(13,15,26,0.95)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow:
                "0 0 0 1px rgba(139,92,246,0.15), 0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(139,92,246,0.08)",
              maxHeight: "min(560px, 70vh)",
            }}
          >
            {/* Search bar */}
            <div
              className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <svg
                className="w-4 h-4 shrink-0"
                style={{ color: "var(--text-muted)" }}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="m11 11 2.5 2.5" />
              </svg>

              <input
                ref={inputRef}
                id={inputId}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="cp-listbox"
                aria-activedescendant={`cp-item-${selectedIndex}`}
                autoComplete="off"
                spellCheck={false}
                placeholder="Найти команду, эпик, роль... или «zen» для фокус-режима"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--text-muted)]"
                style={{ color: "var(--text-primary)" }}
              />

              <div className="flex items-center gap-1 shrink-0">
                <KbdHint>esc</KbdHint>
              </div>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              id="cp-listbox"
              role="listbox"
              className="flex-1 overflow-y-auto py-2"
              style={{ scrollbarWidth: "none" }}
            >
              {flatList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: "var(--glass-02)", border: "1px solid var(--glass-border)" }}
                  >
                    <svg className="w-5 h-5" style={{ color: "var(--text-muted)" }} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Ничего не найдено
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Попробуйте другой запрос
                  </p>
                </div>
              ) : (
                (() => {
                  let globalIdx = 0;
                  return [...grouped.entries()].map(([cat, items]) => (
                    <div key={cat} className="mb-1">
                      <div className="px-4 py-1.5 flex items-center gap-2">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-widest"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {CATEGORY_LABEL[cat]}
                        </span>
                        <div
                          className="flex-1 h-px"
                          style={{ background: "rgba(255,255,255,0.05)" }}
                        />
                      </div>

                      {items.map((cmd) => {
                        const idx = globalIdx++;
                        const isSelected = idx === selectedIndex;
                        return (
                          <CommandRow
                            key={cmd.id}
                            cmd={cmd}
                            idx={idx}
                            isSelected={isSelected}
                            onHover={() => setSelectedIndex(idx)}
                            onSelect={cmd.onSelect}
                          />
                        );
                      })}
                    </div>
                  ));
                })()
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                <KbdHint>↑</KbdHint>
                <KbdHint>↓</KbdHint>
                <span>навигация</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                <KbdHint>↵</KbdHint>
                <span>выбрать</span>
              </div>
              {/* Zen Mode hint */}
              <div className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: "rgba(139,92,246,0.5)" }}>
                <span className="font-mono">◈</span>
                <span>zen</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── CommandRow ───────────────────────────────────────────────────────────────

interface CommandRowProps {
  cmd: CommandItem;
  idx: number;
  isSelected: boolean;
  onHover: () => void;
  onSelect: () => void;
}

function CommandRow({ cmd, idx, isSelected, onHover, onSelect }: CommandRowProps) {
  return (
    <motion.button
      id={`cp-item-${idx}`}
      data-idx={idx}
      role="option"
      aria-selected={isSelected}
      onMouseEnter={onHover}
      onClick={onSelect}
      layout
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100",
        "outline-none focus:outline-none"
      )}
      style={
        isSelected
          ? {
              background: "rgba(139,92,246,0.12)",
              borderLeft: "2px solid var(--accent-500)",
              paddingLeft: "14px",
            }
          : {
              borderLeft: "2px solid transparent",
            }
      }
    >
      <CommandIcon icon={cmd.icon} color={cmd.color} />

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{
            color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
          }}
        >
          {cmd.label}
        </p>
        {cmd.description && (
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
            {cmd.description}
          </p>
        )}
      </div>

      {isSelected && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="shrink-0"
        >
          <svg
            className="w-4 h-4"
            style={{ color: "var(--accent-400)" }}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </motion.div>
      )}
    </motion.button>
  );
}

// ─── Trigger Button ───────────────────────────────────────────────────────────

export function CommandPaletteTrigger({ className }: { className?: string }) {
  const { open } = useCommandPaletteStore();
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <button
      onClick={() => open()}
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all duration-200",
        "hover:bg-[var(--glass-02)]",
        className
      )}
      style={{
        background: "var(--glass-01)",
        border: "1px solid var(--glass-border)",
        color: "var(--text-muted)",
      }}
    >
      <svg
        className="w-3.5 h-3.5 group-hover:text-[var(--text-secondary)] transition-colors"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="m11 11 2.5 2.5" />
      </svg>
      <span className="group-hover:text-[var(--text-secondary)] transition-colors">
        Поиск
      </span>
      <div className="flex items-center gap-0.5 ml-1">
        <KbdHint>{isMac ? "⌘" : "Ctrl"}</KbdHint>
        <KbdHint>K</KbdHint>
      </div>
    </button>
  );
}