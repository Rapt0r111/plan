// НОВЫЙ ФАЙЛ: app/(main)/tasks/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getTaskById } from "@/entities/task/taskRepository";
import { requireWorkspacePage } from "@/shared/lib/page-auth";
import { canAccessTask } from "@/shared/lib/access-scope";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const scope = await requireWorkspacePage();
  const { id } = await params;
  const task = await getTaskById(Number(id));
  if (!task || !canAccessTask(scope, task)) notFound();
  
  // Редиректим на эпик с hash для автооткрытия slideover
  redirect(`/epics/${task.epicId}?openTask=${task.id}`);
}
