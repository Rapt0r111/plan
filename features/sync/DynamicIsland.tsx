"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useNotificationStore } from "./useNotificationStore";
import { useNotificationTimer } from "./model/useNotificationTimer";
import { IslandPill } from "./ui/IslandPill";
import { IslandExpanded } from "./ui/IslandExpanded";

export function DynamicIsland() {
  const { notification, expanded, dismiss, expand, collapse } =
    useNotificationStore();

  useNotificationTimer();

  const handlePillClick = () => {
    if (!notification) return;

    if (expanded) {
      collapse();
    } else {
      expand();
    }
  };

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-9990 flex flex-col items-center gap-2"
      style={{ width: "min(380px, calc(100vw - 32px))" }}
    >
      {/* Pill — always visible */}
      <IslandPill notification={notification} onClick={handlePillClick} />

      {/* Expanded panel */}
      <AnimatePresence mode="wait">
        {notification && expanded && (
          <motion.div
            key="island-expanded"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="w-full overflow-hidden"
          >
            <IslandExpanded notification={notification} onDismiss={dismiss} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}