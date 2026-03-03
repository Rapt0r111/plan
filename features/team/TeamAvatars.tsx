/**
 * @file TeamAvatars.tsx — features/team
 *
 * Overlapping avatar stack for 8 team roles.
 *
 * UX rationale: Overlapping "pile" with negative margin communicates
 * "this is a team" at a glance — a cognitive shortcut borrowed from
 * social apps. On hover the pile fans out, revealing each role badge.
 * This progressive disclosure keeps the sidebar compact by default
 * while giving full context on demand.
 *
 * Accessibility: role tooltip on each avatar via title attr.
 */
"use client";
import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import type { UserWithMeta } from "@/shared/types";

interface Props {
  users: UserWithMeta[];
  maxVisible?: number;
}

export function TeamAvatars({ users, maxVisible = 6 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div
      className="flex flex-col gap-2"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Collapsed pile */}
      <div
        className={cn(
          "flex items-center transition-all duration-300",
          expanded ? "gap-2" : "-space-x-2"
        )}
      >
        {visible.map((user, i) => (
          <Avatar
            key={user.id}
            user={user}
            expanded={expanded}
            index={i}
          />
        ))}
        {overflow > 0 && (
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center",
              "text-xs font-semibold text-white/60",
              "bg-[var(--bg-overlay)] border border-[var(--glass-border)]",
              "ring-2 ring-[var(--bg-base)] relative z-0",
              "transition-all duration-300",
              expanded && "ml-0"
            )}
            title={`+${overflow} ещё`}
          >
            +{overflow}
          </div>
        )}
      </div>

      {/* Expanded role labels — fade in when hovered */}
      {expanded && (
        <div className="space-y-1 stagger">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 px-1 py-0.5"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: user.roleMeta.hex }}
              />
              <span className="text-xs text-[var(--text-secondary)] truncate">
                {user.name}
              </span>
              <span
                className="ml-auto text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0"
                style={{
                  backgroundColor: `${user.roleMeta.hex}22`,
                  color: user.roleMeta.hex,
                }}
              >
                {user.roleMeta.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({
  user,
  expanded,
  index,
}: {
  user: UserWithMeta;
  expanded: boolean;
  index: number;
}) {
  return (
    <div
      title={`${user.name} — ${user.roleMeta.label}`}
      className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
        "text-xs font-bold text-white",
        "ring-2 ring-[var(--bg-base)]",
        "transition-all duration-300 cursor-default",
        "hover:scale-110 hover:z-10",
        !expanded && `relative z-[${10 - index}]`
      )}
      style={{ backgroundColor: user.roleMeta.hex }}
    >
      {user.initials}
    </div>
  );
}