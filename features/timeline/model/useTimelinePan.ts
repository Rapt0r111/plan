// features/timeline/model/useTimelinePan.ts
import { useRef, useCallback, useEffect, useState } from "react";

export interface PanHandlers {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  isDrag: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
}

export function useTimelinePan(): PanHandlers {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, scroll: 0 });
  const pendingX = useRef(0);
  const frameRef = useRef<number | null>(null);
  const moved = useRef(false);
  const [isDrag, setIsDrag] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    dragStart.current = {
      x: e.clientX,
      scroll: scrollRef.current?.scrollLeft ?? 0,
    };
    setIsDrag(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = dragStart.current.x - e.clientX;
    if (Math.abs(dx) > 10) moved.current = true;
    pendingX.current = dragStart.current.scroll + dx;
    if (frameRef.current !== null) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (scrollRef.current) scrollRef.current.scrollLeft = pendingX.current;
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    setIsDrag(false);
  }, []);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  return { scrollRef, isDrag, onPointerDown, onPointerMove, onPointerUp };
}
