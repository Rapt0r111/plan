// app/api/tasks/[id]/assignees/[userId]/route.ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/shared/db/client";
import { taskAssignees } from "@/shared/db/schema";
import { and, eq } from "drizzle-orm";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id, userId } = await params;
    await db
      .delete(taskAssignees)
      .where(
        and(
          eq(taskAssignees.taskId, Number(id)),
          eq(taskAssignees.userId, Number(userId)),
        ),
      );
    revalidateTag(EPICS_CACHE_TAG, "max");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}