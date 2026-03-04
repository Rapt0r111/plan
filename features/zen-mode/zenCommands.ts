/**
 * @file zenCommands.ts — features/zen-mode
 *
 * Команды для Command Palette, активирующие Zen Mode.
 *
 * ИСПОЛЬЗОВАНИЕ в CommandPalette.tsx:
 *
 *   import { buildZenCommands } from "@/features/zen-mode/zenCommands";
 *
 *   // Внутри useMemo в CommandPalette:
 *   const zenCmds = buildZenCommands(epics, activateZen, setQueueZen);
 *   return [...nav, ...epicCmds, ...zenCmds, ...roleCmds, ...actions];
 *
 * FSD CONTRACT:
 *  Эта функция — pure factory, не содержит хуков.
 *  Зависимости передаются снаружи, что делает её тестируемой.
 */

import type { EpicWithTasks, TaskView } from "@/shared/types";

interface ZenCommandItem {
  id: string;
  category: "action";
  label: string;
  description?: string;
  icon: string;
  color?: string;
  onSelect: () => void;
  keywords?: string[];
}

interface ZenHandlers {
  /** Открыть Zen Mode с одной задачей */
  activateWithTask: (task: TaskView) => void;
  /** Открыть Zen Mode с очередью всех pending задач */
  activateWithQueue: (tasks: TaskView[]) => void;
  /** Деактивировать Zen Mode */
  deactivate: () => void;
}

export function buildZenCommands(
  epics: EpicWithTasks[],
  handlers: ZenHandlers,
  close: () => void,
): ZenCommandItem[] {
  // Все незавершённые задачи
  const pendingTasks = epics.flatMap((e) =>
    e.tasks.filter((t) => t.status !== "done")
  );

  // Критические задачи (priority = critical | high)
  const urgentTasks = pendingTasks.filter(
    (t) => t.priority === "critical" || t.priority === "high"
  );

  const commands: ZenCommandItem[] = [
    {
      id: "zen-activate-all",
      category: "action",
      label: "Войти в Zen Mode",
      description: `${pendingTasks.length} незавершённых задач`,
      icon: "◈",
      color: "#a78bfa",
      keywords: ["zen", "фокус", "поток", "focus", "mode", "концентрация"],
      onSelect: () => {
        handlers.activateWithQueue(pendingTasks);
        close();
      },
    },
  ];

  if (urgentTasks.length > 0) {
    commands.push({
      id: "zen-activate-urgent",
      category: "action",
      label: "Zen Mode: Критические задачи",
      description: `${urgentTasks.length} задач с высоким приоритетом`,
      icon: "◈",
      color: "#f87171",
      keywords: ["zen", "критично", "срочно", "urgent", "critical"],
      onSelect: () => {
        handlers.activateWithQueue(urgentTasks);
        close();
      },
    });
  }

  return commands;
}