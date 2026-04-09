"use client";
// useBoardDnD.ts - features/board/hooks
import { useState, useCallback, useRef } from "react";
import { useTaskStore } from "@/shared/store/useTaskStore";
import { useThemeStore } from "@/shared/store/useThemeStore";
import type { TaskStatus, TaskView } from "@/shared/types";

export interface DragState {
  draggingId: number | null;
  overStatus: TaskStatus | null;
}

// ── Ghost element factory ─────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#475569",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "К работе",
  in_progress: "В работе",
  done: "Готово",
  blocked: "Заблокировано",
};

/**
 * Builds a theme-aware off-screen ghost element that mimics a task card.
 * isDark controls background/text/border colours so the ghost matches
 * whichever theme is currently active.
 */
function createGhostElement(task: TaskView, isDark: boolean): HTMLElement {
  const ghost = document.createElement("div");
  ghost.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;z-index:-1;pointer-events:none;";

  const bg = isDark ? "rgba(26,29,53,0.92)" : "rgba(237,233,227,0.95)";
  const textColor = isDark ? "rgba(255,255,255,0.88)" : "rgba(20,15,8,0.88)";
  const mutedColor = isDark ? "rgba(255,255,255,0.30)" : "rgba(20,15,8,0.38)";
  const borderColor = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const trackBg = isDark ? "var(--section-border)" : "rgba(0,0,0,0.06)";

  const priorityColor = PRIORITY_COLOR[task.priority] ?? "#475569";
  const statusLabel = STATUS_LABEL[task.status] ?? task.status;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    display:flex;flex-direction:column;gap:8px;
    padding:10px 12px;
    background:${bg};
    border:1px solid ${borderColor};
    border-left:3px solid ${priorityColor};
    border-radius:12px;
    box-shadow:0 16px 48px rgba(0,0,0,0.45),0 0 0 1px rgba(139,92,246,0.12);
    backdrop-filter:blur(16px);
    -webkit-backdrop-filter:blur(16px);
    pointer-events:none;
    transform:scale(1.04) rotate(-1deg);
    font-family:'DM Sans',sans-serif;
    width:240px;
  `;

  // ── Header ─────────────────────────────

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:6px;";

  const status = document.createElement("div");
  status.style.cssText = `
    display:inline-flex;align-items:center;gap:5px;
    padding:2px 8px;border-radius:99px;
    background:${isDark ? "var(--section-border)" : "rgba(0,0,0,0.06)"};
    font-size:10px;font-weight:500;color:${mutedColor};
  `;

  const statusDot = document.createElement("span");
  statusDot.style.cssText =
    `width:6px;height:6px;border-radius:50%;background:${priorityColor};display:inline-block;`;

  const statusText = document.createElement("span");
  statusText.textContent = statusLabel;

  status.appendChild(statusDot);
  status.appendChild(statusText);

  const idEl = document.createElement("span");
  idEl.textContent = `#${task.id}`;
  idEl.style.cssText =
    "font-size:10px;font-family:'DM Mono',monospace;color:" + mutedColor;

  header.appendChild(status);
  header.appendChild(idEl);

  // ── Title (SAFE) ───────────────────────

  const titleEl = document.createElement("p");
  titleEl.textContent = task.title;
  titleEl.style.cssText = `
    font-size:12px;font-weight:500;line-height:1.45;
    color:${textColor};
    margin:0;
    overflow:hidden;display:-webkit-box;
    -webkit-line-clamp:2;-webkit-box-orient:vertical;
  `;

  // ── Assignees ──────────────────────────

  if (task.assignees.length > 0) {
    const assignees = document.createElement("div");
    assignees.style.cssText = "display:flex;align-items:center;margin-top:2px;";

    task.assignees.slice(0, 3).forEach((a) => {
      const avatar = document.createElement("div");
      avatar.textContent = a.initials;
      avatar.style.cssText = `
        width:18px;height:18px;border-radius:50%;
        background:${a.roleMeta.hex};
        display:inline-flex;align-items:center;justify-content:center;
        font-size:8px;font-weight:700;color:#fff;
        margin-right:-5px;
        border:1.5px solid rgba(0,0,0,0.25);
      `;
      assignees.appendChild(avatar);
    });

    wrapper.appendChild(assignees);
  }

  // ── Progress ───────────────────────────

  const progressTrack = document.createElement("div");
  progressTrack.style.cssText = `
    height:2px;border-radius:99px;
    background:${trackBg};
    overflow:hidden;
  `;

  if (task.progress.total > 0) {
    const progressBar = document.createElement("div");
    const percent = Math.round((task.progress.done / task.progress.total) * 100);

    progressBar.style.cssText = `
      height:100%;border-radius:99px;
      width:${percent}%;
      background:${priorityColor};
    `;

    progressTrack.appendChild(progressBar);
  }

  // ── Assembly ───────────────────────────

  wrapper.appendChild(header);
  wrapper.appendChild(titleEl);
  wrapper.appendChild(progressTrack);

  ghost.appendChild(wrapper);

  return ghost;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBoardDnD() {
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
  const getTask = useTaskStore((s) => s.getTask);
  const [dragState, setDragState] = useState<DragState>({ draggingId: null, overStatus: null });
  const draggingIdRef = useRef<number | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);

  const getDragProps = useCallback(
    (taskId: number) => ({
      draggable: true as const,
      "data-dragging": draggingIdRef.current === taskId,

      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(taskId));

        const task = getTask(taskId);
        if (task && typeof e.dataTransfer.setDragImage === "function") {
          // Read theme at drag time — no need to subscribe reactively
          const isDark = useThemeStore.getState().theme === "dark";
          const ghost = createGhostElement(task, isDark);
          document.body.appendChild(ghost);
          ghostRef.current = ghost;
          e.dataTransfer.setDragImage(ghost, -15, -10);
        }

        setTimeout(() => {
          draggingIdRef.current = taskId;
          setDragState({ draggingId: taskId, overStatus: null });
        }, 0);
      },

      onDragEnd: () => {
        if (ghostRef.current) {
          ghostRef.current.remove();
          ghostRef.current = null;
        }
        draggingIdRef.current = null;
        setDragState({ draggingId: null, overStatus: null });
      },
    }),
    [getTask],
  );

  const getDropProps = useCallback(
    (status: TaskStatus) => ({
      "data-drop-active": dragState.overStatus === status && dragState.draggingId !== null,

      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragState.overStatus !== status) {
          setDragState((s) => ({ ...s, overStatus: status }));
        }
      },

      onDragLeave: () => setDragState((s) => ({ ...s, overStatus: null })),

      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const taskId = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (!isNaN(taskId)) updateTaskStatus(taskId, status);
        setDragState({ draggingId: null, overStatus: null });
        draggingIdRef.current = null;

        if (ghostRef.current) {
          ghostRef.current.remove();
          ghostRef.current = null;
        }
      },
    }),
    [dragState.draggingId, dragState.overStatus, updateTaskStatus],
  );

  return { getDragProps, getDropProps, dragState };
}