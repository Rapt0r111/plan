import Link from "next/link";
import { getMyDayOverview } from "@/entities/my-day/myDayRepository";
import { requireWorkspacePage } from "@/shared/lib/page-auth";
import { Header } from "@/widgets/header/Header";
import { TodayWorkspace } from "./TodayWorkspace";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const scope = await requireWorkspacePage();
  const overview = await getMyDayOverview(new Date(), scope);

  return (
    <div>
      <Header
        title="Сегодня"
        subtitle={`${formatDayLabel(overview.todayKey)} · ${overview.my.stats.total} в личной очереди · ${overview.team.stats.total} сигналов по доступной команде`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/management"
              className="inline-flex min-h-9 items-center rounded-lg border border-(--glass-border) px-3 text-xs font-semibold text-(--text-secondary) transition-colors hover:bg-(--glass-01) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
            >
              Контроль
            </Link>
            {!scope.isVariableRestricted && (
              <Link
                href="/personal-plan"
                className="inline-flex min-h-9 items-center rounded-lg border border-violet-400/25 bg-violet-400/10 px-3 text-xs font-semibold text-(--accent-400) transition-colors hover:bg-violet-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
              >
                Недельный план
              </Link>
            )}
          </div>
        }
      />

      <TodayWorkspace overview={overview} hasProfile={Boolean(scope.profile)} />
    </div>
  );
}

function formatDayLabel(isoDate: string) {
  const value = new Date(`${isoDate}T00:00:00`).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return value.charAt(0).toUpperCase() + value.slice(1);
}
