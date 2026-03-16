// app/api/tasks/[id]/assignees/[userId]/route.ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { removeTaskAssignee } from "@/entities/task/taskRepository"; // ← DAL, не db напрямую
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id, userId } = await params;

    await removeTaskAssignee(Number(id), Number(userId));
    revalidateTag(EPICS_CACHE_TAG, "max");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}