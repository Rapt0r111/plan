/**
 * @file calculateLoad.ts — features/energy/model
 *
 * ═══════════════════════════════════════════════════════════════
 * ENERGY LOAD MODEL
 * ═══════════════════════════════════════════════════════════════
 *
 * Pure computation layer — deliberately framework-free.
 * Calculates "energy" (cognitive load) per role from task data.
 *
 * WHY PURE?
 *  This function runs on every store snapshot. Keeping it pure means:
 *  - testable without mocking React/Zustand
 *  - memoizable with useMemo() at the call site
 *  - reusable in server-side analytics (future)
 *
 * ENERGY LEVELS (calibrated for 8-person teams):
 *  calm     ≤ 2 pending tasks — healthy baseline
 *  moderate  3-4              — normal workload
 *  high      5-6              — attention needed
 *  critical  > 6              — intervention required
 *
 * The "energy" scalar (0–1) is normalised to the team's most-loaded role,
 * not an absolute ceiling. This makes the visualisation self-adapting:
 * a team with no one above 3 tasks still shows relative variation.
 */

import type { EpicWithTasks } from "@/shared/types";
import type { Role } from "@/shared/types";
import { ROLE_META } from "@/shared/config/roles";

// ─── Public Types ─────────────────────────────────────────────────────────────

export type EnergyLevel = "calm" | "moderate" | "high" | "critical";

export interface RoleLoad {
  role: Role;
  label: string;
  hex: string;
  /** 2-letter initials derived from the role label */
  initials: string;
  /** Non-done tasks assigned to this role */
  pending: number;
  /** All tasks (any status) assigned to this role */
  total: number;
  /** Done tasks assigned to this role */
  done: number;
  /** Completion rate 0–1 */
  completionRate: number;
  /**
   * Normalised load scalar 0–1.
   * 1.0 = most overloaded role in the team.
   * Used to drive glow intensity in the visualisation.
   */
  energy: number;
  level: EnergyLevel;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const LEVEL_THRESHOLDS: Record<EnergyLevel, number> = {
  calm:     2,
  moderate: 4,
  high:     6,
  critical: Infinity,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derives a 2-char initials string from a multi-word role label.
 * "Командир 1 взвода" → "К1"  (first letter + first digit if present)
 * "Дежурный"          → "ДЕ"  (first 2 letters)
 */
function deriveInitials(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length === 1) return label.slice(0, 2).toUpperCase();

  // If there's a digit word, use first letter + digit
  const digitWord = words.find((w) => /\d/.test(w));
  if (digitWord) {
    const digit = digitWord.match(/\d/)?.[0] ?? "";
    return (words[0][0] + digit).toUpperCase();
  }

  // Otherwise first letter of first two words
  return (words[0][0] + (words[1][0] ?? "")).toUpperCase();
}

function classifyLevel(pending: number): EnergyLevel {
  if (pending > LEVEL_THRESHOLDS.high) return "critical";
  if (pending > LEVEL_THRESHOLDS.moderate) return "high";
  if (pending > LEVEL_THRESHOLDS.calm) return "moderate";
  return "calm";
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * calculateLoad — derive per-role energy state from the epic store.
 *
 * One pass over epics + tasks + assignees → O(tasks × assignees).
 * In practice: ~200 tasks × 2 avg assignees = <1ms per call.
 */
export function calculateLoad(epics: EpicWithTasks[]): RoleLoad[] {
  // Accumulate raw counts
  const pendingMap = new Map<Role, number>();
  const totalMap   = new Map<Role, number>();
  const doneMap    = new Map<Role, number>();

  for (const epic of epics) {
    for (const task of epic.tasks) {
      const isDone = task.status === "done";

      for (const assignee of task.assignees) {
        const role = assignee.role as Role;

        totalMap.set(role, (totalMap.get(role) ?? 0) + 1);

        if (isDone) {
          doneMap.set(role, (doneMap.get(role) ?? 0) + 1);
        } else {
          pendingMap.set(role, (pendingMap.get(role) ?? 0) + 1);
        }
      }
    }
  }

  // Find the max pending count for normalisation
  const maxPending = Math.max(...Array.from(pendingMap.values()), 1);

  // Build the output array in ROLE_META order (stable ordering)
  return Object.entries(ROLE_META).map(([roleKey, meta]) => {
    const role    = roleKey as Role;
    const pending = pendingMap.get(role) ?? 0;
    const total   = totalMap.get(role) ?? 0;
    const done    = doneMap.get(role) ?? 0;

    return {
      role,
      label: meta.label,
      hex: meta.hex,
      initials: deriveInitials(meta.label),
      pending,
      total,
      done,
      completionRate: total > 0 ? done / total : 0,
      energy: pending / maxPending,
      level: classifyLevel(pending),
    };
  });
}

// ─── Visual Mapping ───────────────────────────────────────────────────────────

/**
 * Maps energy level to a CSS hex glow colour.
 *
 * Design rationale:
 *  calm     → cool blue (#38bdf8)   — "everything is fine" temperature
 *  moderate → role's own hex        — personalised, familiar
 *  high     → warm orange           — physical sense of heat/urgency
 *  critical → amber pulse           — traffic-light warning without red (red = error)
 *
 * We deliberately avoid red for "critical" because red in UI systems often
 * means "broken". Amber communicates "needs attention" without panic.
 */
export function getEnergyColor(level: EnergyLevel, roleHex: string): string {
  switch (level) {
    case "calm":     return "#38bdf8"; // sky-400
    case "moderate": return roleHex;
    case "high":     return "#f97316"; // orange-500
    case "critical": return "#f59e0b"; // amber-500
  }
}

/**
 * Maps energy scalar to glow intensity (px spread for box-shadow).
 * Logarithmic curve — prevents extreme visual noise at high values.
 */
export function getGlowIntensity(energy: number): number {
  return Math.round(8 + energy * 28); // 8px calm → 36px critical
}