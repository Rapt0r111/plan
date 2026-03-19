/**
 * @file route.ts — app/api/tasks/[id]/assignees
 *
 * ИСПРАВЛЕНИЕ: ручная проверка заменена на Zod-схему.
 *   БЫЛО: if (!userId || typeof userId !== "number")
 *         Не ловило: NaN (typeof NaN === "number"), отрицательные числа,
 *         дробные (3.14), 0.
 *   СТАЛО: AddAssigneeSchema — z.number().int().positive()
 *          Ловит все перечисленные кейсы + гарантирует целое положительное.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { addTaskAssignee } from "@/entities/task/taskRepository";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

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

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}