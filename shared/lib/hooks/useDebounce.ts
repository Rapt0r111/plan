"use client";
/**
 * @file useDebounce.ts — shared/lib/hooks
 *
 * Generic debounce hook.
 * Delays updating the returned value until `delay` ms have passed
 * without the input changing — prevents excessive re-renders on fast typing.
 */
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}