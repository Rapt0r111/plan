"use client";
/**
 * @file useBodyScrollLock.ts — shared/lib/hooks
 *
 * Блокирует прокрутку body когда открыты модальные окна / slideover / workspace.
 *
 * ПРОБЛЕМА ДО РЕФАКТОРИНГА:
 *   Одинаковый useEffect копировался в 3 файла:
 *   - TaskSlideover.tsx
 *   - EpicWorkspace.tsx
 *   - (потенциально другие модалы)
 *
 * ДОПОЛНИТЕЛЬНО: При нескольких вложенных модалах (Workspace + Slideover)
 * наивный подход (просто убрать overflow:hidden при любом закрытии) ломает
 * блокировку для родительского модала. Этот хук использует счётчик через
 * data-attribute чтобы снимать блокировку только когда ВСЕ потребители закрыты.
 *
 * ИСПОЛЬЗОВАНИЕ:
 *   useBodyScrollLock(isOpen);
 *
 * useEffect здесь ПРАВОМЕРЕН: DOM side-effect (мутация style/attribute),
 * который не может выполняться во время синхронного рендера.
 */
import { useEffect } from "react";

const DATA_ATTR = "data-scroll-locks";

export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    const body = document.body;

    // Счётчик активных блокировок — предотвращает преждевременное снятие
    // когда открыт Workspace поверх которого открыт Slideover
    const current = parseInt(body.getAttribute(DATA_ATTR) ?? "0", 10);
    const next = current + 1;

    body.setAttribute(DATA_ATTR, String(next));
    body.style.overflow = "hidden";

    return () => {
      const onUnmount = parseInt(body.getAttribute(DATA_ATTR) ?? "1", 10);
      const remaining = onUnmount - 1;

      if (remaining <= 0) {
        body.removeAttribute(DATA_ATTR);
        body.style.overflow = "";
      } else {
        body.setAttribute(DATA_ATTR, String(remaining));
      }
    };
  }, [locked]);
}