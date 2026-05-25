import { headers } from "next/headers";
import { getPersonalPlanData } from "@/entities/personal-plan/personalPlanRepository";
import { getPersonalPlanItemState } from "@/shared/lib/personal-plan";
import { auth } from "@/shared/lib/auth";
import { Header } from "@/widgets/header/Header";
import { PersonalPlanBoard } from "./PersonalPlanBoard";

export const dynamic = "force-dynamic";

export default async function PersonalPlanPage() {
  const [data, session] = await Promise.all([
    getPersonalPlanData(),
    auth.api.getSession({ headers: await headers() }),
  ]);

  const allItems = data.users.flatMap((block) => block.items);
  const today = data.weekDates.find((day) => day.isToday);
  const todayItems = today ? allItems.filter((item) => item.weekday === today.weekday) : [];
  const states = allItems.map((item) => getPersonalPlanItemState(item, data.completions));
  const completed = states.filter((state) => state.isCompleted).length;
  const overdue = states.filter((state) => state.isOverdue).length;
  const current = states.filter((state) => state.isCurrent).length;
  const isAdmin = session?.user?.role === "admin";

  const subtitleParts = [
    `${data.users.length} постоянный состав`,
    `${todayItems.length} сегодня`,
    `${completed}/${allItems.length} выполнено`,
  ];
  if (current > 0) subtitleParts.push(`${current} сейчас`);
  if (overdue > 0) subtitleParts.push(`${overdue} просрочено`);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Личный план"
        subtitle={subtitleParts.join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            {overdue > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {overdue} просрочено
              </div>
            )}
            {isAdmin && (
              <div
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                style={{
                  background: "rgba(139,92,246,0.10)",
                  border: "1px solid rgba(139,92,246,0.25)",
                  color: "#a78bfa",
                }}
              >
                Режим администратора
              </div>
            )}
          </div>
        }
      />

      <PersonalPlanBoard data={data} isAdmin={isAdmin} />
    </div>
  );
}
