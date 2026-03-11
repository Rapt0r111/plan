"use client";
/**
 * PATH:    shared/ui/AmbientCursor.tsx   ← создать новый файл
 * CONNECT: app/GlobalClientComponents.tsx  — там уже живут глобальные клиентские
 *          компоненты, добавить сюда:
 *
 *   // app/GlobalClientComponents.tsx
 *   import { AmbientCursor } from "@/shared/ui/AmbientCursor";
 *
 *   export function GlobalClientComponents() {
 *     return (
 *       <>
 *         <AmbientCursor />   ← добавить первой строкой
 *         ...остальное без изменений...
 *       </>
 *     );
 *   }
 *
 *   GlobalClientComponents уже рендерится в app/layout.tsx — ничего
 *   больше менять не нужно.
 *
 * AmbientCursor.tsx
 * Writes --cursor-x / --cursor-y to <body> via rAF-throttled mousemove.
 * CSS body::before reads these to render a soft radial glow.
 * Zero renders, zero reflows — pure DOM side-effect.
 * Place once in your root layout: <AmbientCursor />
 */
import { useEffect } from "react";

export function AmbientCursor() {
  useEffect(() => {
    let rafId: number | null = null;
    let lastX = 0, lastY = 0;

    function onMouseMove(e: MouseEvent) {
      lastX = e.clientX;
      lastY = e.clientY;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        document.body.style.setProperty("--cursor-x", ((lastX / window.innerWidth)  * 100).toFixed(1) + "%");
        document.body.style.setProperty("--cursor-y", ((lastY / window.innerHeight) * 100).toFixed(1) + "%");
      });
    }

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}