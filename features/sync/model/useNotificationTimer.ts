"use client";

import { useEffect, useRef } from "react";
import { useNotificationStore } from "../useNotificationStore";

const AUTO_DISMISS_MS = 4000;
const COLLAPSE_DELAY_MS = 600;

export function useNotificationTimer() {
  const { notification, dismiss, collapse } = useNotificationStore();

  const id = notification?.id;
  const persistent = notification?.persistent;

  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id || persistent) return;

    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }

    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
    }

    collapseTimer.current = setTimeout(() => {
      collapse();
    }, COLLAPSE_DELAY_MS);

    dismissTimer.current = setTimeout(() => {
      dismiss();
    }, AUTO_DISMISS_MS);

    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current);
      }
    };
  }, [id, persistent, collapse, dismiss]);
}