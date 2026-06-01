import Link from "next/link";
import { getMyDayOverview } from "@/entities/my-day/myDayRepository";
import { groupMyDayAttentionBySection } from "@/shared/lib/my-day";
import { requireWorkspacePage } from "@/shared/lib/page-auth";
import { Header } from "@/widgets/header/Header";
import type { MyDayAttentionItem, MyDaySection } from "@/shared/lib/my-day";
import { TodayQuickActions } from "./TodayQuickActions";

export const dynamic = "force-dynamic";

const WORK_SECTIONS: Array<{
  key: MyDaySection;
  title: string;
  subtitle: string;
  color: string;
}> = [
  {
    key: "urgent",
    title: "Срочно",
    subtitle: "Просрочено и высокий приоритет — начать отсюда.",
    color: "#f87171",
  },
  {
    key: "today",
    title: "Сегодня",
    subtitle: "Срок сегодня и пункты недельного плана на текущий день.",
    color: "#f59e0b",
  },
  {
    key: "later",
    title: "Можно позже",
    subtitle: "Назначенные задачи, близкие сроки и задачи без движения.",
    color: "#8b5cf6",
  },
  {
    key: "waiting",
    title: "Ожидает других",
    subtitle: "Заблокированные задачи и зависимость от других участников.",
    color: "#fb7185",
  },
];

export default async function TodayPage() {
  const scope = await requireWorkspacePage();
  const overview = await getMyDayOverview(new Date(), scope);
  const hasProfile = !!scope.profile;
  const mySections = groupMyDayAttentionBySection(overview.my.attention);

  return (
    <div>
      <Header
        title="Сегодня / Мой день"
        subtitle={`${formatDayLabel(overview.todayKey)} · ${overview.my.stats.total} задач в личном плане · ${overview.team.stats.total} сигналов по команде`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/management"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
            >
              Контроль
            </Link>
            {!scope.isVariableRestricted && (
              <Link
                href="/personal-plan"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "var(--accent-glow)", border: "1px solid rgba(139,92,246,0.3)", color: "var(--accent-400)" }}
              >
                Недельный план
              </Link>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-8">
        <section className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard label="Что делать" value={overview.my.stats.total} color="#a78bfa" />
          <StatCard label="Сегодня" value={overview.my.stats.dueToday} color="#f59e0b" />
          <StatCard label="Просрочено" value={overview.my.stats.overdue} color="#f87171" />
          <StatCard label="Блокировки" value={overview.my.stats.blocked} color="#fb7185" />
          <StatCard label="Без движения" value={overview.my.stats.stale} color="#fbbf24" />
        </section>

        {!hasProfile && (
          <div
            className="rounded-2xl p-4 text-sm"
            style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }}
          >
            У аккаунта нет привязанного профиля исполнителя: личные задачи скрыты, но руководительский контур ниже доступен.
          </div>
        )}

        <Panel
          title="Что делать сейчас"
          subtitle="Единый рабочий список: назначенные задачи, оперативка, недельный план, просрочки, близкие сроки и важные задачи без движения. Сортировка: просрочено → сегодня → высокий приоритет → блок → нет движения."
        >
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 p-4">
            {WORK_SECTIONS.map((section) => (
              <WorkSection
                key={section.key}
                title={section.title}
                subtitle={section.subtitle}
                color={section.color}
                items={mySections[section.key]}
                todayKey={overview.todayKey}
              />
            ))}
          </div>
        </Panel>

        <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <Panel
            title="Кому нужно внимание"
            subtitle="Очередь руководителя по просрочкам, блокировкам и задачам без движения."
          >
            {overview.team.users.length === 0 ? (
              <EmptyState text="Командных отклонений нет." />
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
                {overview.team.users.slice(0, 10).map((item) => (
                  <div key={item.user.name} className="px-5 py-3 flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: attentionColor(item.total) }}
                    >
                      {item.user.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.user.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Просрочено: {item.overdue} · блокировки: {item.blocked} · сегодня: {item.dueToday} · нет движения: {item.stale}
                      </p>
                    </div>
                    <span className="text-sm font-mono" style={{ color: item.total > 2 ? "#f87171" : "var(--accent-400)" }}>
                      {item.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Недельный план сегодня" subtitle="Повторяющиеся задачи текущего дня.">
            {overview.my.personalPlan.length === 0 ? (
              <EmptyState text="На сегодня нет пунктов личного плана." />
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
                {overview.my.personalPlan.map((item) => (
                  <Link key={item.id} href="/personal-plan" className="block px-5 py-3 hover:bg-[var(--glass-01)] transition-colors">
                    <p className="text-xs font-mono" style={{ color: item.color ?? "var(--accent-400)" }}>{item.startTime}–{item.endTime}</p>
                    <p className="text-sm font-medium mt-1" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                    {item.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>{item.description}</p>}
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Panel title="Назначенные задачи" subtitle="Открытые задачи доски на вас.">
            {overview.my.boardTasks.length === 0 ? (
              <EmptyState text="Открытых задач доски на вас нет." />
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
                {overview.my.boardTasks.slice(0, 10).map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="block px-5 py-3 hover:bg-[var(--glass-01)] transition-colors">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{task.title}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {task.epicTitle}{task.dueDate ? ` · срок ${formatShortDate(task.dueDate)}` : ""} · {priorityLabel(task.priority)}
                    </p>
                    {task.blockedReason && <p className="text-xs mt-1" style={{ color: "#fb7185" }}>Причина блокировки: {task.blockedReason}</p>}
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Оперативка" subtitle="Открытые оперативные задачи на сегодня и ближайший контур.">
            {overview.my.operativeTasks.length === 0 ? (
              <EmptyState text="Оперативных задач на вас нет." />
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
                {overview.my.operativeTasks.slice(0, 10).map((task) => (
                  <Link key={task.id} href="/operative" className="block px-5 py-3 hover:bg-[var(--glass-01)] transition-colors">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{task.title}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {task.status === "in_progress" ? "В работе" : "К работе"}{task.dueDate ? ` · срок ${formatShortDate(task.dueDate)}` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <Panel title="Все сигналы команды" subtitle="Просрочки, блокировки, дедлайны на сегодня, отсутствие движения и неназначенные задачи.">
          <AttentionList items={overview.team.attention.slice(0, 20)} empty="Сигналов внимания по команде нет." />
        </Panel>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
      <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-semibold font-mono" style={{ color }}>{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--glass-border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {subtitle && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function WorkSection({ title, subtitle, color, items, todayKey }: { title: string; subtitle: string; color: string; items: MyDayAttentionItem[]; todayKey: string }) {
  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}>
      <div className="px-4 py-3 border-b flex items-start gap-3" style={{ borderColor: "var(--glass-border)" }}>
        <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
            <span className="text-xs font-mono" style={{ color }}>{items.length}</span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
        </div>
      </div>
      <AttentionList items={items} empty={`В разделе «${title}» сейчас пусто.`} todayKey={todayKey} showActions />
    </section>
  );
}

function AttentionList({ items, empty, todayKey, showActions = false }: { items: MyDayAttentionItem[]; empty: string; todayKey?: string; showActions?: boolean }) {
  if (items.length === 0) return <EmptyState text={empty} />;

  return (
    <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
      {items.map((item) => (
        <article
          key={`${item.source}-${item.id}-${item.sortReason}`}
          className="px-5 py-3.5 hover:bg-[var(--glass-01)] transition-colors"
        >
          <div className="flex items-start gap-3">
            <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: riskColor(item.risk) }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={item.href} className="text-sm font-medium hover:underline truncate" style={{ color: "var(--text-primary)" }}>{item.title}</Link>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${riskColor(item.risk)}20`, color: riskColor(item.risk) }}>
                  {item.label}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {sourceLabel(item.source)} · {item.subtitle}
                {item.assigneeNames.length ? ` · ${item.assigneeNames.join(", ")}` : " · без ответственного"}
                {item.dueDate ? ` · ${formatShortDate(item.dueDate)}` : ""}
                {item.priority ? ` · ${priorityLabel(item.priority)}` : ""}
              </p>
              {item.blockedReason && (
                <p className="text-xs mt-1" style={{ color: "#fb7185" }}>
                  Причина блокировки: {item.blockedReason}
                </p>
              )}
              {showActions && todayKey && <TodayQuickActions item={item} todayKey={todayKey} />}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-5 py-10 text-sm text-center" style={{ color: "var(--text-muted)" }}>{text}</div>;
}

function sourceLabel(source: MyDayAttentionItem["source"]) {
  const labels: Record<MyDayAttentionItem["source"], string> = {
    board: "Доска",
    operative: "Оперативка",
    personal_plan: "Недельный план",
  };
  return labels[source];
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    critical: "критический",
    high: "высокий",
    medium: "средний",
    low: "низкий",
  };
  return labels[priority] ?? priority;
}

function riskColor(risk: string) {
  const colors: Record<string, string> = {
    overdue: "#f87171",
    blocked: "#fb7185",
    due_today: "#f59e0b",
    stale: "#fbbf24",
    unassigned: "#c084fc",
    at_risk: "#fb923c",
  };
  return colors[risk] ?? "#94a3b8";
}

function attentionColor(total: number) {
  if (total >= 4) return "#ef4444";
  if (total >= 2) return "#f59e0b";
  return "#8b5cf6";
}

function formatDayLabel(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}
