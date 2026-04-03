/**
 * @file route.ts — app/api/tasks
 *
 * v3 — create-with-relations:
 *   POST теперь принимает опциональные поля:
 *     assigneeIds?: number[]
 *     subtasks?: Array<{ isCompleted: boolean; sortOrder?: number }>
 *   Сервер генерирует title для каждой подзадачи ("Подзадача 1", "Подзадача 2", …).
 *   Всё выполняется в одной транзакции SQLite.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createTaskWithRelations } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";

const SubtaskInputSchema = z.object({
  isCompleted: z.boolean().default(false),
  sortOrder:   z.number().int().min(0).optional(),
});

const CreateTaskSchema = z.object({
  epicId:      z.number().int().positive(),
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  status:      z.enum(["todo", "in_progress", "done", "blocked"]).default("todo"),
  priority:    z.enum(["low", "medium", "high", "critical"]).default("medium"),
  dueDate:     z.string().datetime().nullable().optional(),
  sortOrder:   z.number().int().min(0).default(0),
  // v3: relations
  assigneeIds: z.array(z.number().int().positive()).optional(),
  subtasks:    z.array(SubtaskInputSchema).optional(),
});

export async function POST(req: Request) {
  try {
    const body   = await req.json();
    const parsed = CreateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { assigneeIds, subtasks, ...taskData } = parsed.data;

    const result = await createTaskWithRelations({
      task:        taskData,
      assigneeIds: assigneeIds ?? [],
      subtasks:    (subtasks ?? []).map((s, i) => ({
        title:       `Подзадача ${i + 1}`,   // server-generated, NOT NULL
        isCompleted: s.isCompleted,
        sortOrder:   s.sortOrder ?? i,
      })),
    });

    revalidateTag(EPICS_CACHE_TAG, "max");

    broadcast("task:created", {
      taskId: result.taskId,
      epicId: parsed.data.epicId,
      title:  parsed.data.title,
    });

    return NextResponse.json(
      { ok: true, data: { id: result.taskId, subtaskIds: result.subtaskIds } },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}