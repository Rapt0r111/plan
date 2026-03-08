// shared/store/StoreHydrator.tsx — добавить кеширование:
"use client";
import { useEffect } from "react";
import { useTaskStore } from "./useTaskStore";
import { cacheEpics, getCachedEpics } from "@/shared/lib/localCache";
import type { EpicWithTasks } from "@/shared/types";

interface Props {
  epics: EpicWithTasks[];
}

export function StoreHydrator({ epics }: Props) {
  const hydrateEpics = useTaskStore((s) => s.hydrateEpics);

  useEffect(() => {
    // 1. Немедленно гидрируем из серверных данных
    hydrateEpics(epics);
    // 2. Параллельно кешируем в IndexedDB
    cacheEpics(epics);
  }, [epics, hydrateEpics]);

  return null;
}

// ОТДЕЛЬНЫЙ КОМПОНЕНТ: для офлайн-режима
export function OfflineHydrator() {
  const hydrateEpics = useTaskStore((s) => s.hydrateEpics);
  const epics = useTaskStore((s) => s.epics);

  useEffect(() => {
    // Если стор пустой (SSR не отработал) — грузим из кеша
    if (epics.length === 0) {
      getCachedEpics().then((cached) => {
        if (cached) hydrateEpics(cached as EpicWithTasks[]);
      });
    }
  }, [epics.length, hydrateEpics]);

  return null;
}