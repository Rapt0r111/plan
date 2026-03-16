"use server";
/**
 * @file epicActions.ts — entities/epic
 *
 * Server Actions для CRUD эпиков.
 * Вызываются из EpicsTab через useTransition — никакого fetch на клиенте.
 *
 * revalidateTag("max") — stale-while-revalidate, рекомендованный профиль Next.js 16.
 */
import { revalidateTag } from "next/cache";
import {
  createEpic,
  updateEpic,
  deleteEpic,
  EPICS_CACHE_TAG,
} from "./epicRepository";
import type { DbEpic } from "@/shared/types";

type EpicPatch = Partial<{
  title:       string;
  description: string | null;
  color:       string;
  startDate:   string | null;
  endDate:     string | null;
}>;

export async function createEpicAction(data: {
  title:       string;
  description: string | null;
  color:       string;
  startDate:   string | null;
  endDate:     string | null;
}): Promise<DbEpic> {
  const epic = await createEpic(data);
  revalidateTag(EPICS_CACHE_TAG, "max");
  return epic;
}

export async function updateEpicAction(
  id:   number,
  data: EpicPatch,
): Promise<DbEpic> {
  const epic = await updateEpic(id, data);
  revalidateTag(EPICS_CACHE_TAG, "max");
  return epic;
}

export async function deleteEpicAction(id: number): Promise<void> {
  await deleteEpic(id);
  revalidateTag(EPICS_CACHE_TAG, "max");
}