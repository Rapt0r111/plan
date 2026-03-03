"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import type { DbEpic } from "@/shared/types";

interface Props {
  epics: (DbEpic & { taskCount: number; doneCount: number })[];
}

const NAV = [
  { href: "/dashboard", label: "Обзор", icon: "⬡" },
];

export function Sidebar({ epics }: Props) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-950 flex flex-col z-20 border-r border-slate-800">
      {/* Logo */}
      <div className="px-5 h-14 flex items-center border-b border-slate-800">
        <span className="text-white font-semibold tracking-tight text-sm">
          Task<span className="text-indigo-400">Flow</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="px-3 pt-4 space-y-0.5">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
              pathname === item.href
                ? "bg-indigo-600 text-white font-medium"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Epics list */}
      <div className="px-3 pt-6 flex-1 overflow-y-auto">
        <p className="px-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Эпики
        </p>
        <div className="space-y-0.5">
          {epics.map((epic) => {
            const pct = epic.taskCount > 0 ? Math.round((epic.doneCount / epic.taskCount) * 100) : 0;
            const isActive = pathname === `/epics/${epic.id}`;
            return (
              <Link
                key={epic.id}
                href={`/epics/${epic.id}`}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group",
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                )}
              >
                {/* Epic color dot */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: epic.color }}
                />
                <span className="flex-1 truncate">{epic.title}</span>
                <span className="text-xs text-slate-600 font-mono group-hover:text-slate-400 transition-colors">
                  {pct}%
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-600">v2.0.0 · Intranet</p>
      </div>
    </aside>
  );
}