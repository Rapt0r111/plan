"use client";
/**
 * @file useIsOffline.ts — shared/lib/hooks
 *
 * SSR-safe hook that returns true when the browser is offline.
 * Uses useSyncExternalStore (React-blessed pattern) for correct
 * server/client hydration without mismatch.
 *
 * Server snapshot always returns false — no hydration warning.
 * Subscribe/snapshot functions are module-level — stable references,
 * no unnecessary re-subscriptions.
 */
import { useSyncExternalStore } from "react";

const subscribe = (callback: () => void): (() => void) => {
  window.addEventListener("online",  callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online",  callback);
    window.removeEventListener("offline", callback);
  };
};

const getSnapshot       = () => !navigator.onLine;
const getServerSnapshot = () => false; // SSR: assume online

/**
 * useIsOffline — returns true when navigator.onLine === false.
 *
 * @example
 * const offline = useIsOffline();
 * <button disabled={offline}>Сохранить</button>
 */
export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}