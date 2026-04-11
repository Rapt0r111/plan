/**
 * @file page.tsx — app/(main)/operative
 *
 * ИСПРАВЛЕНИЯ v3:
 *  1. isAdmin теперь РЕАЛЬНО определён через server session
 *     (был undefined → runtime crash)
 *  2. Session получается через better-auth server API
 *  3. isAdmin передаётся в OperativePage корректно
 */
import { getAllUsersWithOperativeTasks } from "@/entities/operative/operativeRepository";
import { Header } from "@/widgets/header/Header";
import { OperativePage } from "./OperativePage";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function OperativeRoute() {
  // ── Получаем сессию текущего пользователя ────────────────────────────────
  // auth.api.getSession — server-side вызов better-auth.
  // Возвращает null если пользователь не авторизован.
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Проверяем роль: "admin" = администратор (из authUsers.role)
  const isAdmin = session?.user?.role === "admin";

  const data = await getAllUsersWithOperativeTasks();

  const allTasks = data.flatMap((b) => b.tasks);
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const inProgress = allTasks.filter((t) => t.status === "in_progress").length;

  const now = new Date();
  const overdue = allTasks.filter((t) => {
    if (t.status === "done" || !t.dueDate) return false;
    return new Date(t.dueDate) < now;
  }).length;

  const todayStr = now.toDateString();
  const dueToday = allTasks.filter((t) => {
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
            {/* Показываем Admin badge если пользователь — администратор */}
            {isAdmin && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                style={{
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  color: "#a78bfa",
                }}
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M6 1l1.5 3H11L8.5 6l1 3L6 7.5 2.5 9l1-3L1 4h3.5z" />
                </svg>
                Администратор
              </div>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* isAdmin теперь корректно определён и передаётся */}
        <OperativePage initialData={data} isAdmin={isAdmin} />
      </div>
    </div>
  );
}