// features/command-palette/model/usePaletteCommands.ts
"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useCommandPaletteStore } from "../useCommandPaletteStore";
import { useZenStore } from "@/features/zen-mode/useZenStore";
import { buildZenCommands } from "@/features/zen-mode/zenCommands";
import { ROLE_META } from "@/shared/config/roles";
import type { CommandItem } from "./fuzzy";

export function usePaletteCommands(): CommandItem[] {
  const router  = useRouter();
  const epics   = useTaskStore((s) => s.epics);
  const { close } = useCommandPaletteStore();
  const { activate: activateZen, setQueue: setZenQueue } = useZenStore();

  return useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      {
        id: "nav-dashboard", category: "navigation",
        label: "Перейти на обзор",
        description: "Главная страница с эпиками и командой",
        icon: "📊", keywords: ["dashboard", "главная", "обзор", "home"],
        onSelect: () => { router.push("/dashboard"); close(); },
      },
      {
        id: "nav-board", category: "navigation",
        label: "Открыть доску",
        description: "Spatial Canvas — все задачи по эпикам",
        icon: "🗂️", keywords: ["board", "доска", "задачи", "kanban"],
        onSelect: () => { router.push("/board"); close(); },
      },
    ];

    const epicCmds: CommandItem[] = epics.map((epic) => ({
      id: `epic-${epic.id}`, category: "epic" as const,
      label: epic.title,
      description: `${epic.progress.done}/${epic.progress.total} задач · ${
        epic.progress.total > 0
          ? Math.round((epic.progress.done / epic.progress.total) * 100) : 0
      }%`,
      icon: "📋", color: epic.color,
      keywords: ["эпик", "epic", epic.title],
      onSelect: () => { router.push(`/epics/${epic.id}`); close(); },
    }));

    const teamCmds: CommandItem[] = Object.values(ROLE_META).map((meta) => ({
      id: `role-${meta.role}`, category: "team" as const,
      label: meta.label,
      description: "Фильтровать задачи по роли → Доска",
      icon: meta.label.slice(0, 2), color: meta.hex,
      keywords: [meta.role, "роль", "фильтр", "команда"],
      onSelect: () => { router.push("/board"); close(); },
    }));

    const zenCmds = buildZenCommands(
      epics,
      { activate: activateZen, setQueue: setZenQueue },
      close,
    );

    const actions: CommandItem[] = [
      ...zenCmds,
      {
        id: "action-sync", category: "action",
        label: "Обновить данные",
        description: "Принудительная синхронизация с базой данных",
        icon: "🔄", keywords: ["refresh", "sync", "обновить", "перезагрузить"],
        onSelect: () => { router.refresh(); close(); },
      },
      {
        id: "action-filter-todo", category: "action",
        label: "Показать: К работе",
        description: "Открыть доску с фильтром статуса",
        icon: "⏳", color: "#64748b",
        keywords: ["todo", "к работе", "фильтр", "статус"],
        onSelect: () => { router.push("/board"); close(); },
      },
      {
        id: "action-filter-blocked", category: "action",
        label: "Показать: Заблокировано",
        description: "Найти все заблокированные задачи",
        icon: "🚫", color: "#f87171",
        keywords: ["blocked", "заблокировано", "проблема"],
        onSelect: () => { router.push("/board"); close(); },
      },
      {
        id: "action-filter-done", category: "action",
        label: "Показать: Завершённые",
        description: "Только выполненные задачи",
        icon: "✅", color: "#34d399",
        keywords: ["done", "готово", "завершено", "выполнено"],
        onSelect: () => { router.push("/board"); close(); },
      },
    ];

    return [...nav, ...epicCmds, ...teamCmds, ...actions];
  }, [epics, router, close, activateZen, setZenQueue]);
}