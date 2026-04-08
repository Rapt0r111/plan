// features/command-palette/CommandPalette.tsx
"use client";
import {
  useState, useEffect, useRef,
  useMemo, useCallback, useId,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCommandPaletteStore } from "./useCommandPaletteStore";
import { useKeyboardShortcuts } from "@/shared/lib/hooks/useKeyboardShortcuts";
import { useDebounce } from "@/shared/lib/hooks/useDebounce";
import { usePaletteCommands } from "./model/usePaletteCommands";
import { usePaletteTaskSearch } from "./model/usePaletteTaskSearch";
import { scoreFuzzy, CATEGORY_ORDER, CATEGORY_LABEL } from "./model/fuzzy";
import { CommandRow } from "./ui/CommandRow";
import { PaletteFooter } from "./ui/PaletteFooter";
import type { CommandCategory } from "./model/fuzzy";

const SEARCH_DEBOUNCE_MS = 350;

export function CommandPalette() {
  const { isOpen, initialQuery, close, open } = useCommandPaletteStore();
  const commands = usePaletteCommands();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen, initialQuery]);

  useKeyboardShortcuts([
    { key: "k", meta: true, handler: () => (isOpen ? close() : open()) },
  ]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((cmd) => ({ cmd, score: scoreFuzzy(query, cmd) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd);
  }, [commands, query]);

  const taskResults = usePaletteTaskSearch(debouncedQuery);

  const grouped = useMemo(() => {
    const map = new Map<CommandCategory, typeof filtered>();
    for (const cat of CATEGORY_ORDER) {
      if (cat === "task") continue;
      const items = filtered.filter((c) => c.category === cat);
      if (items.length) map.set(cat, items);
    }
    if (taskResults.length > 0) {
      map.set("task", taskResults);
    }
    return map;
  }, [filtered, taskResults]);

  const flatList = useMemo(() => [...grouped.values()].flat(), [grouped]);

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(flatList.length - 1, 0)));
  }, [flatList.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          close();
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % flatList.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + flatList.length) % flatList.length);
          break;
        case "Enter":
          if (flatList[selectedIndex]) flatList[selectedIndex].onSelect();
          break;
      }
    },
    [close, flatList, selectedIndex],
  );

  const isSearchPending =
    query.trim().length >= 2 && query !== debouncedQuery;

  const isEmpty = flatList.length === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — was rgba(8,9,15,0.65), now var(--modal-backdrop) */}
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50"
            style={{
              backdropFilter: "blur(12px)",
              background: "var(--modal-backdrop)",
            }}
            onClick={close}
            aria-hidden="true"
          />

          {/* Panel — was rgba(13,15,26,0.95), now var(--modal-bg) */}
          <motion.div
            key="cp-panel"
            role="dialog"
            aria-label="Command palette"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed left-1/2 top-[18%] z-50 w-full max-w-160 -translate-x-1/2 flex flex-col overflow-hidden"
            style={{
              borderRadius: "20px",
              background: "var(--modal-bg)",
              border: "1px solid var(--glass-border)",
              boxShadow: [
                "0 0 0 1px rgba(139,92,246,0.15)",
                "0 32px 80px rgba(0,0,0,0.35)",
                "0 0 60px rgba(139,92,246,0.06)",
              ].join(", "),
              maxHeight: "min(560px, 70vh)",
            }}
          >
            {/* ── Search bar ─────────────────────────────────────────────── */}
            <div
              className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderBottom: "1px solid var(--glass-border)" }}
            >
              <svg
                className="w-4 h-4 shrink-0 text-(--text-muted)"
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
                placeholder="Поиск команд и задач... или «zen» для фокус-режима"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-(--text-muted) text-(--text-primary)"
              />

              {isSearchPending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="shrink-0 w-3.5 h-3.5"
                >
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
                    viewBox="0 0 14 14"
                    fill="none"
                    style={{ color: "var(--accent-400)" }}
                  >
                    <circle
                      cx="7" cy="7" r="5"
                      stroke="rgba(139,92,246,0.2)"
                      strokeWidth="2"
                    />
                    <path
                      d="M7 2a5 5 0 0 1 5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </motion.div>
              )}

              <kbd
                className="px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0"
                style={{
                  background: "var(--glass-02)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-muted)",
                }}
              >
                esc
              </kbd>
            </div>

            {/* ── Results ────────────────────────────────────────────────── */}
            <div
              ref={listRef}
              id="cp-listbox"
              role="listbox"
              className="flex-1 overflow-y-auto py-2"
              style={{ scrollbarWidth: "none" }}
            >
              {isEmpty ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3"
                    style={{
                      background: "var(--glass-02)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    <svg
                      className="w-5 h-5 text-(--text-muted)"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-(--text-secondary)">
                    Ничего не найдено
                  </p>
                  <p className="text-xs mt-1 text-(--text-muted)">
                    Попробуйте другой запрос
                  </p>
                </div>
              ) : (
                (() => {
                  let globalIdx = 0;
                  return [...grouped.entries()].map(([cat, items]) => (
                    <div key={cat} className="mb-1">
                      <div className="px-4 py-1.5 flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">
                          {CATEGORY_LABEL[cat]}
                        </span>
                        {cat === "task" && (
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "rgba(139,92,246,0.12)",
                              color: "var(--accent-400)",
                              border: "1px solid rgba(139,92,246,0.2)",
                            }}
                          >
                            {items.length}
                          </span>
                        )}
                        <div
                          className="flex-1 h-px"
                          style={{ background: "var(--glass-border)" }}
                        />
                      </div>

                      {items.map((cmd) => {
                        const idx = globalIdx++;
                        return (
                          <CommandRow
                            key={cmd.id}
                            cmd={cmd}
                            idx={idx}
                            isSelected={idx === selectedIndex}
                            searchQuery={query}
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

            <PaletteFooter />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}