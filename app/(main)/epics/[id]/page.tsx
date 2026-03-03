import { notFound } from "next/navigation";
import { getEpicById } from "@/entities/epic/epicRepository";
import { Header } from "@/widgets/header/Header";
import { TaskCard } from "@/widgets/task-list/TaskCard";
// 1. Import the type you defined in shared/types
import type { EpicWithTasks } from "@/shared/types";

const STATUS_ORDER = ["in_progress", "todo", "blocked", "done"] as const;

// 2. Use the imported type here. 
// This avoids the "Property 'tasks' does not exist on ... | null" error.
function groupByStatus(tasks: EpicWithTasks["tasks"]) {
  const groups = {
    in_progress: [],
    todo: [],
    blocked: [],
    done: [],
  } as Record<string, typeof tasks>;

  for (const t of tasks) {
    if (groups[t.status]) {
      groups[t.status].push(t);
    }
  }
  return groups;
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: "В работе",
  todo: "К работе",
  blocked: "Заблокировано",
  done: "Готово",
};

export default async function EpicDetailPage({ params }: { params: { id: string } }) {
  const epic = await getEpicById(Number(params.id));
  
  // 3. This check strips 'null' from the type
  if (!epic) {
    notFound();
  }

  // Now 'epic' is guaranteed to be 'EpicWithTasks', so .tasks works
  const grouped = groupByStatus(epic.tasks);
  
  const pct = epic.progress.total > 0
    ? Math.round((epic.progress.done / epic.progress.total) * 100)
    : 0;

  return (
    <div>
      <Header
        title={epic.title}
        subtitle={`${epic.progress.done}/${epic.progress.total} задач · ${pct}% выполнено`}
      />

      <div className="p-6">
        {/* Epic progress bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex items-center gap-4">
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: epic.color || "#cbd5e1" }} // Fallback color added
          />
          <div className="flex-1">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: epic.color || "#cbd5e1" }}
              />
            </div>
          </div>
          <span className="font-mono text-sm font-semibold text-slate-700 shrink-0">
            {pct}%
          </span>
          {epic.description && (
            <p className="text-xs text-slate-500 shrink-0 max-w-xs truncate hidden xl:block">
              {epic.description}
            </p>
          )}
        </div>

        {/* Grouped task columns */}
        <div className="space-y-8">
          {STATUS_ORDER.map((status) => {
            const group = grouped[status];
            if (!group?.length && status === "blocked") return null;
            
            return (
              <section key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-slate-700">
                    {STATUS_LABEL[status]}
                  </h2>
                  <span className="text-xs font-mono text-slate-400">
                    {group?.length || 0}
                  </span>
                </div>
                {!group || group.length === 0 ? (
                  <p className="text-xs text-slate-400 pl-1">Нет задач</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {group.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}