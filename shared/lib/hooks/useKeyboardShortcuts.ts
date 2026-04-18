"use client";

import { useEffect, useRef } from "react";

export type ShortcutHandler = (e: KeyboardEvent) => void;

export interface Shortcut {
  key: string;
  meta?: boolean;
  shift?: boolean;
  preventDefault?: boolean;
  handler: ShortcutHandler;
}

/**
 * Normalize key safely
 */
function normalizeKey(key: unknown): string {
  if (typeof key !== "string") return "";
  if (key === "Unidentified") return "";
  return key.toLowerCase();
}

/**
 * Check if user is typing in editable element
 */
function isEditableElement(): boolean {
  const el = document.activeElement;
  if (!el) return false;

  const tag = el.tagName?.toLowerCase?.();
  if (!tag) return false;

  return (
    tag === "input" ||
    tag === "textarea" ||
    (el as HTMLElement).isContentEditable === true
  );
}

/**
 * Dev-only warning (tree-shaken in prod)
 */
function warnDev(message: string, data?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[useKeyboardShortcuts] ${message}`, data);
  }
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  // 🔒 Avoid stale closures & re-binding listeners
  const shortcutsRef = useRef<Shortcut[]>(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = normalizeKey(e.key);
      if (!key) return;

      const isTyping = isEditableElement();

      for (const shortcut of shortcutsRef.current) {
        // 🛡️ Hard validation
        if (!shortcut || typeof shortcut !== "object") {
          warnDev("Invalid shortcut object", shortcut);
          continue;
        }

        const shortcutKey = normalizeKey(shortcut.key);
        if (!shortcutKey) {
          warnDev("Shortcut missing valid key", shortcut);
          continue;
        }

        // Skip typing context unless meta is required
        if (!shortcut.meta && isTyping) continue;

        const keyMatch = key === shortcutKey;
        if (!keyMatch) continue;

        const metaMatch = shortcut.meta
          ? e.metaKey || e.ctrlKey
          : true;

        if (!metaMatch) continue;

        const shiftMatch = shortcut.shift
          ? e.shiftKey
          : true;

        if (!shiftMatch) continue;

        const shouldPrevent =
          shortcut.preventDefault ?? !!shortcut.meta;

        if (shouldPrevent) {
          e.preventDefault();
        }

        try {
          shortcut.handler(e);
        } catch (err) {
          warnDev("Shortcut handler crashed", {
            shortcut,
            error: err,
          });
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}

/**
 * Single shortcut wrapper
 */
export function useSingleShortcut(shortcut: Shortcut) {
  useKeyboardShortcuts([shortcut]);
}