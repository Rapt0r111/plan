"use client";
/**
 * @file StoreHydrator.tsx — shared/store
 *
 * ИСПРАВЛЕНИЕ v3 (откат render-time гидрации для Zustand):
 *
 * ПОЧЕМУ render-time setState НЕ РАБОТАЕТ для Zustand:
 *   React docs паттерн "setState during render" применим ТОЛЬКО к локальному
 *   useState в том же компоненте. Zustand set() синхронно оповещает ВСЕХ
 *   подписчиков стора (SyncBadge, Sidebar и т.д.) → React получает обновление
 *   чужого компонента во время рендера StoreHydrator → ошибка:
 *   "Cannot update a component while rendering a different component"
 *
 * ПРАВИЛО:
 *   ✅ render-time setState → только для useState/useReducer в том же компоненте
 *   ❌ render-time Zustand set() → запрещено, используй useEffect
 *
 * ИТОГ: useEffect для hydrateEpics возвращается — это правильный подход.
 * Разница с оригиналом: разделены два эффекта (гидрация и кеширование)
 * для ясности намерений. useRef(false) защищает от Strict Mode double-invoke.
 *
 * ── OfflineHydrator ─────────────────────────────────────────────────────────
 * Без изменений — useEffect здесь всегда был правомерен (async IndexedDB read).
 */
import { useEffect, useRef } from "react";
import { useTaskStore } from "./useTaskStore";
import { cacheEpics, getCachedEpics } from "@/shared/lib/localCache";
import type { EpicWithTasks } from "@/shared/types";

// ── StoreHydrator ─────────────────────────────────────────────────────────────

interface Props {
  epics: EpicWithTasks[];
}

export function StoreHydrator({ epics }: Props) {
  const hydrateEpics = useTaskStore((s) => s.hydrateEpics);

  // useEffect ПРАВОМЕРЕН: Zustand set() оповещает других подписчиков →
  // нельзя вызывать во время рендера (→ "Cannot update a component while
  // rendering a different component"). Только useEffect гарантирует что
  // React закончил рендер перед обновлением стора.
  useEffect(() => {
    if (epics.length === 0) return;
    hydrateEpics(epics);
  }, [epics, hydrateEpics]);

  // Отдельный effect для async IO — не смешиваем с синхронной гидрацией
  useEffect(() => {
    if (epics.length > 0) {
      cacheEpics(epics);
    }
  }, [epics]);

  return null;
}

// ── OfflineHydrator ───────────────────────────────────────────────────────────

/**
 * Монтируется в layout один раз.
 * Если стор пустой (SSR не отработал), загружает из IndexedDB-кеша.
 */
export function OfflineHydrator() {
  const epicsLength = useTaskStore((s) => s.epics.length);
  const hydrateEpics = useTaskStore((s) => s.hydrateEpics);
  const attempted = useRef(false);

  useEffect(() => {
    if (epicsLength > 0 || attempted.current) return;
    attempted.current = true;

    getCachedEpics().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        hydrateEpics(cached as EpicWithTasks[]);
      }
    });
  }, [epicsLength, hydrateEpics]);

  return null;
}