/**
 * @file page.tsx — app/(main)/operative
 *
 * Server Component: получает всех пользователей с их оперативными задачами.
 * v2: улучшенная статистика в заголовке (в работе / просрочено / дедлайн сегодня)
 */
import { getAllUsersWithOperativeTasks } from "@/entities/operative/operativeRepository";
import { Header } from "@/widgets/header/Header";
import { OperativePage } from "./OperativePage";

export const dynamic = "force-dynamic";

export default async function OperativeRoute() {
  const data = await getAllUsersWithOperativeTasks();

  const allTasks = data.flatMap(b => b.tasks);
  const totalTasks = allTasks.length;
  const doneTasks  = allTasks.filter(t => t.status === "done").length;
  const inProgress = allTasks.filter(t => t.status === "in_progress").length;

  // Просроченные (dueDate < now и статус не done)
  const now = new Date();
  const overdue = allTasks.filter(t => {
    if (t.status === "done" || !t.dueDate) return false;
    return new Date(t.dueDate) < now;
  }).length;

  // Дедлайн сегодня
  const todayStr = now.toDateString();
  const dueToday = allTasks.filter(t => {
    if (t.status === "done" || !t.dueDate) return false;
    return new Date(t.dueDate).toDateString() === todayStr;
  }).length;

  const subtitleParts: string[] = [`${data.length} бойцов`];
  if (inProgress > 0) subtitleParts.push(`${inProgress} в работе`);
  if (overdue > 0) subtitleParts.push(`${overdue} просрочено`);
  if (dueToday > 0 && overdue === 0) subtitleParts.push(`${dueToday} сегодня`);
  if (totalTasks > 0) subtitleParts.push(`${doneTasks}/${totalTasks} выполнено`);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Оперативные задачи"
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
            {inProgress > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                style={{
                  background: "rgba(56,189,248,0.10)",
                  border: "1px solid rgba(56,189,248,0.25)",
                  color: "#38bdf8",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                {inProgress} в работе
              </div>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <OperativePage initialData={data} />
      </div>
    </div>
  );
}