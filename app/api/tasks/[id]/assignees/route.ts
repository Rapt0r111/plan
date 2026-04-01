/**
 * @file route.ts — app/api/tasks/[id]/assignees
 *
 * РЕФАКТОРИНГ v2 — Real-time broadcast при добавлении/удалении исполнителя.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { addTaskAssignee } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";
import { broadcast } from "@/shared/server/eventBus";

const AddAssigneeSchema = z.object({
  userId: z.number().int().positive(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = AddAssigneeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    await addTaskAssignee(taskId, parsed.data.userId);
    revalidateTag(EPICS_CACHE_TAG, "max");

    broadcast("task:assignee:added", { taskId, userId: parsed.data.userId });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}