/**
 * @file route.ts — app/api/operative-tasks/[id]
 *
 * PATCH /api/operative-tasks/:id — изменить статус задачи.
 * DELETE намеренно отсутствует.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  updateOperativeTaskStatus,
} from "@/entities/operative/operativeRepository";
import { broadcast } from "@/shared/server/eventBus";
import { OPERATIVE_CACHE_TAG } from "../route";

const PatchSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body   = await req.json();
    const parsed = PatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const task = await updateOperativeTaskStatus(taskId, parsed.data.status);
    revalidateTag(OPERATIVE_CACHE_TAG, "max");
    broadcast("task:updated", { source: "operative", taskId, status: parsed.data.status });

    return NextResponse.json({ ok: true, data: task });
  } catch (e) {
    if (String(e).includes("not found")) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}