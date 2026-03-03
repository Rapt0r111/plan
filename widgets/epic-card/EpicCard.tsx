import Link from "next/link";
import type { DbEpic } from "@/shared/types";
import { formatDate } from "@/shared/lib/utils";

interface Props {
  epic: DbEpic & { taskCount: number; doneCount: number };
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  complete: { label: "Завершён", cls: "bg-emerald-100 text-emerald-700" },
  active:   { label: "Активен",  cls: "bg-indigo-100 text-indigo-700" },
  planned:  { label: "Планируется", cls: "bg-slate-100 text-slate-600" },
};

function epicStatus(epic: DbEpic & { taskCount: number; doneCount: number }) {
  if (epic.taskCount > 0 && epic.doneCount === epic.taskCount) return "complete";
  if (epic.startDate && new Date(epic.startDate) <= new Date()) return "active";
  return "planned";
}

export function EpicCard({ epic }: Props) {
  const pct = epic.taskCount > 0 ? Math.round((epic.doneCount / epic.taskCount) * 100) : 0;
  const status = epicStatus(epic);
  const { label, cls } = STATUS_LABEL[status];

  return (
    <Link
      href={`/epics/${epic.id}`}
      className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: epic.color }}
          />
          <h3 className="font-semibold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
            {epic.title}
          </h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cls}`}>
          {label}
        </span>
      </div>

      {/* Description */}
      {epic.description && (
        <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
          {epic.description}
        </p>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-slate-500">Прогресс</span>
          <span className="text-xs font-mono font-medium text-slate-700">{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: epic.color }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono">{epic.doneCount}/{epic.taskCount} задач</span>
        {epic.endDate && (
          <span>до {formatDate(epic.endDate)}</span>
        )}
      </div>
    </Link>
  );
}