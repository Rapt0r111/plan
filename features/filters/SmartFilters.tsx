
/**
 * @file SmartFilters.tsx — features/filters
 *
 * Premium glass-chip filter bar.
 * Each chip uses the role/status color as tinted background when active —
 * immediate visual connection between filter state and board result.
 * "Clear" only appears when filters are active (Jakob's Law — no clutter).
 */
"use client";
import { useCallback } from "react";
import { cn } from "@/shared/lib/utils";
import { useRoleStore } from "@/shared/store/useRoleStore";
import type { TaskStatus, TaskPriority, TaskView } from "@/shared/types";

export interface FilterState {
  roleKeys:   string[];
  statuses:   TaskStatus[];
  priorities: TaskPriority[];
}

export const EMPTY_FILTERS: FilterState = {
  roleKeys:   [],
  statuses:   [],
  priorities: [],
};

interface Props {
  filters:  FilterState;
  onChange: (next: FilterState) => void;
}

const STATUS_OPTS: { value: TaskStatus; label: string; color: string }[] = [
  { value: "todo",        label: "К работе",      color: "#64748b" },
  { value: "in_progress", label: "В работе",       color: "#38bdf8" },
  { value: "done",        label: "Готово",         color: "#34d399" },
  { value: "blocked",     label: "Заблокировано",  color: "#f87171" },
];

const PRIORITY_OPTS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "critical", label: "Критично", color: "#ef4444" },
  { value: "high",     label: "Высокий",  color: "#f97316" },
  { value: "medium",   label: "Средний",  color: "#eab308" },
  { value: "low",      label: "Низкий",   color: "#475569" },
];

export function SmartFilters({ filters, onChange }: Props) {
  const roles = useRoleStore((s) => s.roles);

  const hasActive =
    filters.roleKeys.length > 0 ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0;

  const toggle = useCallback(
    <T extends string>(key: keyof FilterState, value: T) => {
      const arr = filters[key] as T[];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      onChange({ ...filters, [key]: next });
    },
    [filters, onChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {roles.length > 0 && (
        <Group label="Роль">
          {roles.map((r) => (
            <Chip
              key={r.key}
              label={r.label}
              color={r.hex}
              active={filters.roleKeys.includes(r.key)}
              onClick={() => toggle("roleKeys", r.key)}
            />
          ))}
        </Group>
      )}

      <Sep />

      <Group label="Статус">
        {STATUS_OPTS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            color={o.color}
            active={filters.statuses.includes(o.value)}
            onClick={() => toggle("statuses", o.value)}
          />
        ))}
      </Group>

      <Sep />

      <Group label="Приоритет">
        {PRIORITY_OPTS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            color={o.color}
            active={filters.priorities.includes(o.value)}
            onClick={() => toggle("priorities", o.value)}
          />
        ))}
      </Group>

      {hasActive && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[rgba(239,68,68,0.12)] text-[#f87171] border border-[rgba(239,68,68,0.25)] hover:bg-[rgba(239,68,68,0.20)] transition-all duration-150"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
          Сбросить
        </button>
      )}
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-(--text-muted) font-medium shrink-0">
        {label}:
      </span>
      {children}
    </div>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-[var(--glass-border)] shrink-0" />;
}

function Chip({
  label,
  color,
  active,
  onClick,
}: {
  label:   string;
  color:   string;
  active:  boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200",
        "hover:scale-[1.03] active:scale-[0.97]",
        !active &&
          "bg-[var(--glass-01)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
      )}
      style={
        active
          ? {
              backgroundColor: `${color}22`,
              color,
              borderColor: `${color}44`,
              boxShadow: `0 0 10px ${color}20`,
            }
          : undefined
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color, opacity: active ? 1 : 0.4 }}
      />
      {label}
    </button>
  );
}

export function applyFilters(
  tasks: TaskView[],
  filters: FilterState,
): TaskView[] {
  return tasks.filter((t) => {
    if (
      filters.roleKeys.length > 0 &&
      !t.assignees.some((a) => filters.roleKeys.includes(a.roleMeta.key))
    )
      return false;
    if (
      filters.statuses.length > 0 &&
      !filters.statuses.includes(t.status)
    )
      return false;
    if (
      filters.priorities.length > 0 &&
      !filters.priorities.includes(t.priority)
    )
      return false;
    return true;
  });
}