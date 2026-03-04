/**
 * @file zenCommands.ts — features/zen-mode
 *
 * РЕФАКТОРИНГ v2:
 *  ДО: CommandPalette.tsx полностью игнорировал этот модуль и реализовывал
 *      ту же логику инлайн (~40 строк). Сигнатуры не совпадали:
 *      buildZenCommands ожидал { activateWithTask, activateWithQueue },
 *      а useZenStore экспортирует { activate, setQueue }.
 *
 *  ПОСЛЕ: Интерфейс ZenHandlers выровнен под useZenStore API.
 *      CommandPalette импортирует и использует эту функцию напрямую.
 *
 * КОНТРАКТ FSD:
 *  Pure factory — без хуков, без React. Зависимости передаются снаружи.
 *  Тестируется изолированно от UI.
 */

import type { EpicWithTasks, TaskView } from "@/shared/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZenCommandItem {
  id: string;
  category: "action";
  label: string;
  description?: string;
  icon: string;
  color?: string;
  keywords?: string[];
  onSelect: () => void;
}

/**
 * ZenHandlers — интерфейс, выровненный под useZenStore.
 * Принимает функции напрямую из store без обёрток.
 */
export interface ZenHandlers {
  /** useZenStore: setQueue(tasks) + activate() */
  setQueue: (tasks: TaskView[]) => void;
  activate: () => void;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * buildZenCommands — строит команды для Command Palette.
 *
 * @param epics - список эпиков из Zustand store
 * @param handlers - { setQueue, activate } из useZenStore
 * @param close - функция закрытия палитры
 * @returns массив ZenCommandItem для встройки в список команд
 *
 * @example
 * // Внутри useMemo в CommandPalette.tsx:
 * const { activate, setQueue } = useZenStore();
 * const zenCmds = buildZenCommands(epics, { activate, setQueue }, close);
 * return [...nav, ...epicCmds, ...zenCmds, ...actions];
 */
export function buildZenCommands(
  epics: EpicWithTasks[],
  handlers: ZenHandlers,
  close: () => void,
): ZenCommandItem[] {
  const { setQueue, activate } = handlers;

  const pendingTasks = epics.flatMap((e) =>
    e.tasks.filter((t) => t.status !== "done")
  );

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
        setQueue(pendingTasks);
        activate();
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
        setQueue(urgentTasks);
        activate();
        close();
      },
    });
  }

  return commands;
}