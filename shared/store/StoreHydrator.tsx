"use client";
/**
 * @file StoreHydrator.tsx — shared/store
 *
 * ИСПРАВЛЕНИЕ v4 — правильный порядок инициализации:
 *
 * ПРОБЛЕМА v3:
 *   React выполняет useEffect снизу вверх по дереву компонентов.
 *   StoreHydrator (в page.tsx) запускает эффект РАНЬШЕ SyncOrchestrator (в
 *   layout.tsx). Это означало: hydrateEpics() вызывался при
 *   pendingPatchTaskIds = {} (пустом), и офлайн-изменения статуса/приоритета
 *   ПЕРЕЗАПИСЫВАЛИСЬ серверными данными.
 *
 * РЕШЕНИЕ v4:
 *   Перед вызовом hydrateEpics явно вызываем refreshOfflineQueue() из IDB.
 *   Это гарантирует, что pendingPatchTaskIds заполнен актуальными данными
 *   ДО того как серверные эпики смёрджатся с локальным стором.
 *
 *   Используем useTaskStore.getState() вместо хуков — корректно в
 *   async-контексте внутри useEffect и не создаёт лишних подписок.
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
  useEffect(() => {
    if (epics.length === 0) return;

    // КЛЮЧЕВОЙ ПОРЯДОК:
    // 1. refreshOfflineQueue() — загружает pendingPatchTaskIds из IDB
    // 2. hydrateEpics(epics)   — мёрджит сервер + локальный стор
    //
    // Без шага 1 hydrateEpics не знает какие задачи «защищать» от
    // перезаписи серверными данными, и офлайн-изменения статуса/
    // приоритета стираются.
    const { refreshOfflineQueue, hydrateEpics } = useTaskStore.getState();
    refreshOfflineQueue().then(() => {
      hydrateEpics(epics);
    });
  }, [epics]);

  // Кеш в IndexedDB — отдельный эффект, не блокирует гидрацию
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
  const attempted = useRef(false);

  useEffect(() => {
    if (epicsLength > 0 || attempted.current) return;
    attempted.current = true;

    getCachedEpics().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        useTaskStore.getState().hydrateEpics(cached as EpicWithTasks[]);
      }
    });
  }, [epicsLength]);

  return null;
}