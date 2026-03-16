// app/api/tasks/[id]/assignees/route.ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { addTaskAssignee } from "@/entities/task/taskRepository"; // ← DAL, не db напрямую
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { userId } = await req.json();

    if (!userId || typeof userId !== "number") {
      return NextResponse.json(
        { ok: false, error: "userId must be a number" },
        { status: 422 },
      );
    }

    await addTaskAssignee(Number(id), userId);
    revalidateTag(EPICS_CACHE_TAG, "max");

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}