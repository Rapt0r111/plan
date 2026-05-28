import Link from "next/link";
import { Header } from "@/widgets/header/Header";
import { getManagementOverview } from "@/entities/management/managementRepository";
import { formatRiskLabel } from "@/shared/lib/management-metrics";
import { requireWorkspacePage } from "@/shared/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  const scope = await requireWorkspacePage();
  const overview = await getManagementOverview(new Date(), scope);

  const kpis = [
    { label: "Открыто задач", value: overview.kpi.openTasks, color: "#38bdf8" },
    { label: "Выполнено", value: `${overview.kpi.completionRate}%`, color: "#34d399" },
    { label: "Требует внимания", value: overview.kpi.attentionRequired, color: "#f87171" },
    { label: "Личный план", value: `${overview.kpi.personalPlanCompletionRate}%`, color: "#a78bfa" },
  ];

  return (
    <div>
      <Header
        title="Контроль"
        subtitle="SaaS-панель управления сроками, рисками, нагрузкой и исполнением"
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/api/reports/management?format=csv"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
            >
              CSV
            </a>
            <a
              href="/api/reports/management?format=html"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "var(--accent-glow)", border: "1px solid rgba(139,92,246,0.3)", color: "var(--accent-400)" }}
            >
              HTML-отчет
            </a>
          </div>
        }
      />

      <div className="p-6 space-y-8">
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {kpis.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl p-4"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
            >
              <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{item.label}</p>
              <p className="text-2xl font-semibold font-mono" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--glass-border)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Очередь управленческого внимания</h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Просрочки, блокировки, задачи без движения и без ответственных.
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
              {overview.attentionQueue.length === 0 ? (
                <div className="px-5 py-10 text-sm text-center" style={{ color: "var(--text-muted)" }}>
                  Нет критичных отклонений.
                </div>
              ) : overview.attentionQueue.map((task) => (
                <Link
                  key={`${task.id}-${task.risk}`}
                  href={`/tasks/${task.id}`}
                  className="block px-5 py-3.5 hover:bg-[var(--glass-01)] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: riskColor(task.risk) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{task.title}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${riskColor(task.risk)}20`, color: riskColor(task.risk) }}>
                          {task.riskLabel}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        {task.epicTitle} · {task.assignees.map((user) => user.name).join(", ") || "без ответственного"}
                        {task.dueDate ? ` · срок ${task.dueDate.slice(0, 10)}` : ""}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Риски по портфелю</h2>
            <div className="space-y-2">
              {Object.entries(overview.riskSummary)
                .filter(([, count]) => count > 0)
                .map(([risk, count]) => (
                  <div key={risk} className="flex items-center gap-3">
                    <span className="w-28 text-xs" style={{ color: "var(--text-muted)" }}>{formatRiskLabel(risk as keyof typeof overview.riskSummary)}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--glass-01)" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.max(8, (count / Math.max(1, overview.kpi.totalTasks)) * 100)}%`, background: riskColor(risk) }} />
                    </div>
                    <span className="w-8 text-right text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--glass-border)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Нагрузка команды</h2>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
              {overview.workload.slice(0, 10).map((item) => (
                <div key={item.user.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: item.user.roleMeta.hex }}>
                    {item.user.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.user.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Доска: {item.boardOpen} · Оперативно: {item.operativeOpen} · Просрочено: {item.overdue}
                    </p>
                  </div>
                  <span className="text-sm font-mono" style={{ color: item.totalOpen > 8 ? "#f87171" : "var(--accent-400)" }}>{item.totalOpen}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--glass-border)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Ближайший календарь</h2>
            </div>
            <div className="divide-y max-h-[420px] overflow-y-auto" style={{ borderColor: "var(--glass-border)" }}>
              {overview.calendar.slice(0, 16).map((event, index) => (
                <div key={`${event.date}-${event.type}-${index}`} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-16 text-xs font-mono" style={{ color: "var(--text-muted)" }}>{event.date.slice(5)}</div>
                  <span className="w-2 h-2 rounded-full" style={{ background: event.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{event.title}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{event.subtitle}</p>
                  </div>
                  <span className="text-[10px] uppercase font-mono" style={{ color: "var(--text-muted)" }}>{event.type}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function riskColor(risk: string) {
  const colors: Record<string, string> = {
    overdue: "#f87171",
    blocked: "#fb7185",
    due_today: "#f59e0b",
    stale: "#fbbf24",
    unassigned: "#c084fc",
    at_risk: "#fb923c",
    completed: "#34d399",
    on_track: "#38bdf8",
  };
  return colors[risk] ?? "#94a3b8";
}
