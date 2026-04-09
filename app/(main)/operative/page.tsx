/**
 * @file page.tsx — app/(main)/operative
 *
 * Server Component: получает всех пользователей с их оперативными задачами.
 *
 * force-dynamic обязателен — данные обновляются при добавлении пользователей
 * и при изменении задач, кешировать нельзя.
 */
import { getAllUsersWithOperativeTasks } from "@/entities/operative/operativeRepository";
import { Header } from "@/widgets/header/Header";
import { OperativePage } from "./OperativePage";

export const dynamic = "force-dynamic";

export default async function OperativeRoute() {
  const data = await getAllUsersWithOperativeTasks();

  const totalTasks = data.reduce((s, b) => s + b.tasks.length, 0);
  const doneTasks  = data.reduce(
    (s, b) => s + b.tasks.filter((t) => t.status === "done").length,
    0,
  );
  const inProgress = data.reduce(
    (s, b) => s + b.tasks.filter((t) => t.status === "in_progress").length,
    0,
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Оперативные задачи"
        subtitle={
          totalTasks > 0
            ? `${data.length} бойцов · ${inProgress} в работе · ${doneTasks}/${totalTasks} выполнено`
            : `${data.length} бойцов — задач пока нет`
        }
        actions={
          totalTasks > 0 ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{
                background:  "rgba(52,211,153,0.1)",
                border:      "1px solid rgba(52,211,153,0.25)",
                color:       "#34d399",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "#34d399" }}
              />
              {doneTasks}/{totalTasks}
            </div>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto">
        <OperativePage initialData={data} />
      </div>
    </div>
  );
}