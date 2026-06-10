"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { MyDayOverview } from "@/entities/my-day/myDayRepository";
import type { MyDayAttentionItem, MyDaySection } from "@/shared/lib/my-day";
import { TodayQuickActions } from "./TodayQuickActions";

type QueueFilter = "all" | "overdue" | "due_today" | "blocked" | "stale";

const FILTERS: Array<{ key: QueueFilter; label: string; tone: string }> = [
  { key: "all", label: "В работе", tone: "var(--accent-400)" },
  { key: "overdue", label: "Просрочено", tone: "#f87171" },
  { key: "due_today", label: "Сегодня", tone: "#f0b429" },
  { key: "blocked", label: "Блокировки", tone: "#fb7185" },
  { key: "stale", label: "Без движения", tone: "#fbbf24" },
];

const SECTIONS: Array<{ key: MyDaySection; title: string; description: string }> = [
  { key: "urgent", title: "Сначала", description: "Просроченное и задачи высокого приоритета" },
  { key: "today", title: "Сегодня", description: "Срок сегодня и текущие пункты плана" },
  { key: "later", title: "Далее", description: "Назначенные задачи и ближайшие сроки" },
  { key: "waiting", title: "Ожидает", description: "Зависимости и заблокированная работа" },
];

export function TodayWorkspace({ overview, hasProfile }: { overview: MyDayOverview; hasProfile: boolean }) {
  const [activeFilter, setActiveFilter] = useState<QueueFilter>("all");
  const [visibleLimit, setVisibleLimit] = useState(24);

  const visibleItems = useMemo(() => {
    if (activeFilter === "all") return overview.my.attention;
    return overview.my.attention.filter((item) => item.risk === activeFilter);
  }, [activeFilter, overview.my.attention]);

  const renderedItems = useMemo(() => visibleItems.slice(0, visibleLimit), [visibleItems, visibleLimit]);

  const sectionItems = useMemo(() => {
    const grouped: Record<MyDaySection, MyDayAttentionItem[]> = { urgent: [], today: [], later: [], waiting: [] };
    for (const item of renderedItems) grouped[item.section].push(item);
    return grouped;
  }, [renderedItems]);

  const counts: Record<QueueFilter, number> = {
    all: overview.my.stats.total,
    overdue: overview.my.stats.overdue,
    due_today: overview.my.stats.dueToday,
    blocked: overview.my.stats.blocked,
    stale: overview.my.stats.stale,
  };

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6">
      {!hasProfile && <ProfileNotice />}

      <section aria-labelledby="queue-title" className="overflow-hidden rounded-[20px] border border-(--glass-border) bg-(--bg-elevated)">
        <div className="border-b border-(--glass-border) px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-(--accent-400)">Рабочий фокус</p>
              <h1 id="queue-title" className="mt-1 text-xl font-semibold tracking-[-0.02em] text-(--text-primary)">
                Что требует внимания сейчас
              </h1>
              <p className="mt-1 text-sm leading-6 text-(--text-secondary)">
                Очередь уже отсортирована по сроку, приоритету и блокировкам. Начните с первого доступного действия.
              </p>
            </div>

            <div aria-label="Фильтр рабочей очереди" className="flex max-w-full gap-2 overflow-x-auto pb-1 2xl:justify-end" role="group">
              {FILTERS.map((filter) => {
                const selected = activeFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setActiveFilter(filter.key);
                      setVisibleLimit(24);
                    }}
                    className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) sm:min-h-9"
                    style={{
                      background: selected ? "var(--glass-03)" : "var(--glass-01)",
                      borderColor: selected ? filter.tone : "var(--glass-border)",
                    }}
                  >
                    <span className="text-xs font-medium" style={{ color: selected ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {filter.label}
                    </span>
                    <span className="font-mono text-xs tabular-nums" style={{ color: filter.tone }}>{counts[filter.key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid min-h-[560px] xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 xl:border-r xl:border-(--glass-border)">
            {visibleItems.length === 0 ? (
              <QueueEmpty filter={activeFilter} onReset={() => setActiveFilter("all")} />
            ) : (
              <div onKeyDown={handleQueueKeyDown}>
                {SECTIONS.map((section) => {
                  const items = sectionItems[section.key];
                  if (items.length === 0) return null;
                  return (
                    <section key={section.key} aria-labelledby={`today-section-${section.key}`}>
                      <div className="flex items-baseline justify-between gap-4 border-b border-(--glass-border) bg-(--glass-01) px-4 py-2.5 sm:px-5">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <h2 id={`today-section-${section.key}`} className="text-xs font-semibold text-(--text-primary)">{section.title}</h2>
                          <p className="hidden truncate text-xs text-(--text-muted) sm:block">{section.description}</p>
                        </div>
                        <span className="font-mono text-[0.6875rem] tabular-nums text-(--text-muted)">{items.length}</span>
                      </div>
                      <div className="divide-y divide-(--glass-border)">
                        {items.map((item) => <QueueItem key={`${item.source}-${item.id}-${item.sortReason}`} item={item} todayKey={overview.todayKey} />)}
                      </div>
                    </section>
                  );
                })}
                {visibleItems.length > renderedItems.length && (
                  <div className="border-t border-(--glass-border) px-4 py-4 text-center sm:px-5">
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((value) => value + 24)}
                      className="min-h-11 rounded-lg border border-(--glass-border) bg-(--glass-01) px-4 text-xs font-semibold text-(--text-secondary) transition-colors hover:bg-(--glass-02) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
                    >
                      Показать ещё {Math.min(24, visibleItems.length - renderedItems.length)}
                    </button>
                    <p className="mt-2 font-mono text-[0.6875rem] tabular-nums text-(--text-muted)">
                      Показано {renderedItems.length} из {visibleItems.length}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside aria-label="Контекст дня" className="border-t border-(--glass-border) bg-(--bg-surface) xl:border-t-0">
            <DaySchedule items={overview.my.personalPlan} />
            <TeamAttention users={overview.team.users} attention={overview.team.attention} />
          </aside>
        </div>
      </section>
    </main>
  );
}

function QueueItem({ item, todayKey }: { item: MyDayAttentionItem; todayKey: string }) {
  const color = riskColor(item.risk);
  return (
    <article
      data-queue-row
      tabIndex={0}
      className="group px-4 py-4 outline-none transition-colors hover:bg-(--glass-01) focus-visible:bg-(--glass-01) focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--focus-ring-color) sm:px-5"
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) window.location.assign(item.href);
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={item.href} className="text-sm font-semibold leading-5 text-(--text-primary) hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)">
              {item.title}
            </Link>
            <span className="rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold" style={{ background: `${color}18`, color }}>
              {item.label}
            </span>
          </div>

          <p className="mt-1 text-xs leading-5 text-(--text-secondary)">
            {sourceLabel(item.source)} · {item.subtitle}
            {item.dueDate ? ` · ${formatShortDate(item.dueDate)}` : ""}
            {item.priority ? ` · ${priorityLabel(item.priority)}` : ""}
          </p>
          <p className="mt-0.5 truncate text-xs text-(--text-muted)">
            {item.assigneeNames.length ? item.assigneeNames.join(", ") : "Ответственный не назначен"}
          </p>

          {item.blockedReason && (
            <p className="mt-2 rounded-lg bg-rose-400/8 px-3 py-2 text-xs leading-5 text-rose-300">
              Причина блокировки: {item.blockedReason}
            </p>
          )}

          <TodayQuickActions item={item} todayKey={todayKey} />
        </div>
      </div>
    </article>
  );
}

function DaySchedule({ items }: { items: MyDayOverview["my"]["personalPlan"] }) {
  return (
    <section aria-labelledby="schedule-title" className="border-b border-(--glass-border) p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id="schedule-title" className="text-sm font-semibold text-(--text-primary)">План на сегодня</h2>
          <p className="mt-1 text-xs text-(--text-muted)">Текущие пункты недельного плана</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-(--accent-400)">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <CompactEmpty text="На сегодня нет пунктов плана." href="/personal-plan" action="Открыть недельный план" />
      ) : (
        <div className="mt-4 space-y-1">
          {items.map((item) => (
            <Link key={item.id} href="/personal-plan" className="grid grid-cols-[58px_1fr] gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-(--glass-01) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)">
              <span className="font-mono text-[0.6875rem] leading-5 tabular-nums text-(--text-muted)">{item.startTime}<br />{item.endTime}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-5 text-(--text-primary)">{item.title}</span>
                {item.description && <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-(--text-muted)">{item.description}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function TeamAttention({ users, attention }: { users: MyDayOverview["team"]["users"]; attention: MyDayOverview["team"]["attention"] }) {
  return (
    <section aria-labelledby="team-title" className="p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id="team-title" className="text-sm font-semibold text-(--text-primary)">Командные риски</h2>
          <p className="mt-1 text-xs text-(--text-muted)">Люди, которым сейчас нужно внимание</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-(--text-muted)">{attention.length}</span>
      </div>

      {users.length === 0 ? (
        <CompactEmpty text="По доступной команде рисков нет." />
      ) : (
        <div className="mt-4 divide-y divide-(--glass-border)">
          {users.slice(0, 8).map((item) => (
            <div key={item.user.name} className="flex items-center gap-3 py-3 first:pt-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: attentionColor(item.total) }}>
                {item.user.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--text-primary)">{item.user.name}</p>
                <p className="mt-0.5 text-[0.6875rem] leading-4 text-(--text-muted)">
                  {item.overdue} просрочено · {item.blocked} блок · {item.stale} без движения
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums" style={{ color: item.total > 2 ? "#f87171" : "var(--accent-400)" }}>{item.total}</span>
            </div>
          ))}
        </div>
      )}

      {attention.length > 0 && (
        <details className="group mt-4 border-t border-(--glass-border) pt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-2 text-xs font-semibold text-(--text-secondary) transition-colors hover:bg-(--glass-01) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)">
            Все сигналы команды
            <span className="font-mono text-[0.6875rem] group-open:hidden">показать</span>
            <span className="hidden font-mono text-[0.6875rem] group-open:inline">скрыть</span>
          </summary>
          <div className="mt-2 space-y-1">
            {attention.slice(0, 12).map((item) => (
              <Link key={`${item.source}-${item.id}-${item.sortReason}`} href={item.href} className="block rounded-lg px-2 py-2 text-xs leading-5 text-(--text-secondary) transition-colors hover:bg-(--glass-01) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)">
                <span className="font-medium text-(--text-primary)">{item.title}</span>
                <span className="block truncate text-(--text-muted)">{item.label} · {item.assigneeNames.join(", ") || "Без ответственного"}</span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function ProfileNotice() {
  return (
    <div role="status" className="mb-4 flex flex-col gap-2 rounded-[14px] border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm text-amber-200 sm:flex-row sm:items-center sm:justify-between">
      <span>Личный профиль исполнителя не привязан, поэтому персональная очередь скрыта.</span>
      <Link href="/profile" className="font-semibold text-amber-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">Проверить профиль</Link>
    </div>
  );
}

function QueueEmpty({ filter, onReset }: { filter: QueueFilter; onReset: () => void }) {
  const message = filter === "all" ? "В личной очереди нет открытой работы." : `Нет задач в категории «${FILTERS.find((item) => item.key === filter)?.label}».`;
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-base font-semibold text-(--text-primary)">{filter === "all" ? "На сегодня всё спокойно" : "Фильтр пуст"}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-(--text-muted)">{message}</p>
      {filter !== "all" && <button type="button" onClick={onReset} className="mt-4 min-h-11 rounded-lg border border-(--glass-border) px-4 text-xs font-semibold text-(--text-secondary) transition-colors hover:bg-(--glass-01) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)">Показать всю очередь</button>}
    </div>
  );
}

function CompactEmpty({ text, href, action }: { text: string; href?: string; action?: string }) {
  return (
    <div className="mt-4 rounded-[14px] bg-(--glass-01) px-4 py-5 text-center">
      <p className="text-xs leading-5 text-(--text-muted)">{text}</p>
      {href && action && <Link href={href} className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-(--accent-400) hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)">{action}</Link>}
    </div>
  );
}

function handleQueueKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const current = (event.target as HTMLElement).closest<HTMLElement>("[data-queue-row]");
  if (!current) return;
  const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-queue-row]"));
  const index = rows.indexOf(current);
  const nextIndex = event.key === "ArrowDown" ? Math.min(rows.length - 1, index + 1) : Math.max(0, index - 1);
  if (nextIndex !== index) {
    event.preventDefault();
    rows[nextIndex]?.focus();
  }
}

function sourceLabel(source: MyDayAttentionItem["source"]) {
  return { board: "Доска", operative: "Оперативная задача", personal_plan: "Недельный план" }[source];
}

function priorityLabel(priority: string) {
  return { critical: "Критический приоритет", high: "Высокий приоритет", medium: "Средний приоритет", low: "Низкий приоритет" }[priority] ?? priority;
}

function riskColor(risk: string) {
  return { overdue: "#f87171", blocked: "#fb7185", due_today: "#f0b429", stale: "#fbbf24", unassigned: "#c084fc", at_risk: "#38bdf8" }[risk] ?? "#94a3b8";
}

function attentionColor(total: number) {
  if (total >= 4) return "#dc2626";
  if (total >= 2) return "#d97706";
  return "#6d28d9";
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}
