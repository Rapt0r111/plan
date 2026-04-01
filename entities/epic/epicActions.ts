"use server";
/**
 * @file epicActions.ts — entities/epic
 *
 * РЕФАКТОРИНГ v2 — Real-time broadcast в Server Actions.
 *   После каждой мутации вызываем broadcast() из eventBus.
 *   Server Actions запускаются на сервере → доступ к eventBus корректен.
 */
import { revalidateTag } from "next/cache";
import {
  createEpic,
  updateEpic,
  deleteEpic,
  EPICS_CACHE_TAG,
} from "./epicRepository";
import { broadcast } from "@/shared/server/eventBus";
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
  broadcast("epic:created", { epicId: epic.id, title: epic.title });
  return epic;
}

export async function updateEpicAction(
  id:   number,
  data: EpicPatch,
): Promise<DbEpic> {
  const epic = await updateEpic(id, data);
  revalidateTag(EPICS_CACHE_TAG, "max");
  broadcast("epic:updated", { epicId: id, patch: data });
  return epic;
}

export async function deleteEpicAction(id: number): Promise<void> {
  await deleteEpic(id);
  revalidateTag(EPICS_CACHE_TAG, "max");
  broadcast("epic:deleted", { epicId: id });
}