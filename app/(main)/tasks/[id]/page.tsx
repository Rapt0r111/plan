// НОВЫЙ ФАЙЛ: app/(main)/tasks/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getTaskById } from "@/entities/task/taskRepository";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskById(Number(id));
  if (!task) notFound();
  
  // Редиректим на эпик с hash для автооткрытия slideover
  redirect(`/epics/${task.epicId}?openTask=${task.id}`);
}