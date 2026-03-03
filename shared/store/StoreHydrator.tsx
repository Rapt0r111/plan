/**
 * @file StoreHydrator.tsx — shared/store
 * Thin client component that pushes server-fetched data into Zustand.
 * Keeps server components pure while enabling client-side reactivity.
 */
"use client";
import { useEffect } from "react";
import { useTaskStore } from "./useTaskStore";
import type { EpicWithTasks } from "@/shared/types";

interface Props {
  epics: EpicWithTasks[];
}

export function StoreHydrator({ epics }: Props) {
  const hydrateEpics = useTaskStore((s) => s.hydrateEpics);

  useEffect(() => {
    hydrateEpics(epics);
  }, [epics, hydrateEpics]);

  return null;
}