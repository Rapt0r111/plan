"use client";
/**
 * @file useKeyboardShortcuts.ts — shared/lib/hooks
 *
 * Centralised keyboard shortcut manager.
 *
 * WHY THIS EXISTS (2026 context):
 *  Power-users in modern B2B tools expect keyboard-first navigation.
 *  Linear, Notion, Vercel Dashboard — all prove that Cmd+K reduces
 *  the average "time-to-action" from ~4 clicks to ~1.2 keystrokes.
 *  This hook owns that contract for the entire app.
 *
 * DESIGN:
 *  - Single event listener on `document` — no per-component leakage.
 *  - Respects OS: Cmd on macOS, Ctrl everywhere else.
 *  - Guards against firing inside <input>, <textarea>, [contenteditable].
 *  - Returns a cleanup fn — safe for React 19 strict-mode double-invoke.
 */

import { useEffect, useCallback } from "react";

export type ShortcutHandler = (e: KeyboardEvent) => void;

export interface Shortcut {
    /** Key to listen for (case-insensitive) */
    key: string;
    /** Require Cmd (Mac) / Ctrl (Win/Linux)? Default: false */
    meta?: boolean;
    /** Require Shift? Default: false */
    shift?: boolean;
    /** Suppress default browser action? Default: true when meta=true */
    preventDefault?: boolean;
    handler: ShortcutHandler;
}

/**
 * Returns true if the active element is a text input,
 * where we should NOT intercept most shortcuts.
 */
function isEditableElement(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return (
        tag === "input" ||
        tag === "textarea" ||
        (el as HTMLElement).isContentEditable
    );
}

/**
 * useKeyboardShortcuts — register one or many global shortcuts.
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: "k", meta: true, handler: openPalette },
 *   { key: "Escape", handler: closePalette },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            for (const shortcut of shortcuts) {
                const keyMatch =
                    typeof e.key === "string" &&
                    typeof shortcut.key === "string" &&
                    e.key.toLowerCase() === shortcut.key.toLowerCase();

                // Meta key: Cmd on macOS, Ctrl on Windows/Linux
                const metaMatch = shortcut.meta
                    ? e.metaKey || e.ctrlKey
                    : true;

                const shiftMatch = shortcut.shift ? e.shiftKey : true;

                // For non-meta shortcuts, skip if user is typing
                const skipEditable = !shortcut.meta && isEditableElement();

                if (keyMatch && metaMatch && shiftMatch && !skipEditable) {
                    // Default: prevent browser action when meta is held
                    const shouldPrevent = shortcut.preventDefault ?? !!shortcut.meta;
                    if (shouldPrevent) e.preventDefault();

                    shortcut.handler(e);
                    // Don't break — allow multiple shortcuts on the same key
                }
            }
        },
        [shortcuts]
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);
}

/**
 * useSingleShortcut — convenience wrapper for one shortcut.
 */
export function useSingleShortcut(shortcut: Shortcut) {
    useKeyboardShortcuts([shortcut]);
}