/**
 * @file page.tsx — app/(main)/operative
 *
 * ИСПРАВЛЕНИЯ v6:
 *  - Выход: заменена HTML-форма (POST → API, показывала JSON) на LogoutButton
 *    (client component) — теперь router.push("/login") работает корректно.
 *  - Доступ: isAdmin определяется на сервере по session.user.role
 */
import Link from "next/link";
import { getAllUsersWithOperativeTasks } from "@/entities/operative/operativeRepository";
import { Header } from "@/widgets/header/Header";
import { OperativePage } from "./OperativePage";
import { LogoutButton } from "./LogoutButton";
import { auth } from "@/shared/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function SessionBadge() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{
          background: "rgba(139,92,246,0.12)",
          border: "1px solid rgba(139,92,246,0.3)",
          color: "#a78bfa",
        }}
      >
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 2H10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8M5 9l3-3-3-3M8 6H1" />
        </svg>
        Войти
      </Link>
    );
  }

  const initials = session.user.name
    .trim()
    .split(/\s+/)
    .map((w: string) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isAdmin = session.user.role === "admin";

  return (
    <div className="flex items-center gap-2">
      {/* User badge */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium"
        style={{
          background: isAdmin ? "rgba(139,92,246,0.10)" : "rgba(100,116,139,0.10)",
          border: `1px solid ${isAdmin ? "rgba(139,92,246,0.25)" : "rgba(100,116,139,0.25)"}`,
          color: isAdmin ? "#a78bfa" : "#94a3b8",
        }}
      >
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
          style={{ backgroundColor: isAdmin ? "#8b5cf6" : "#64748b" }}
        >
          {initials}
        </div>
        <span className="max-w-25 truncate">{session.user.name.split(" ")[0]}</span>
        {isAdmin && (
          <span className="text-[9px] font-semibold opacity-75">· Адм.</span>
        )}
      </div>

      {/* ✅ ИСПРАВЛЕНО: LogoutButton — client component, использует router.push вместо form POST */}
      <LogoutButton />
    </div>
  );
}

export default async function OperativeRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
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
            <SessionBadge />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <OperativePage initialData={data} isAdmin={isAdmin} />
      </div>
    </div>
  );
}