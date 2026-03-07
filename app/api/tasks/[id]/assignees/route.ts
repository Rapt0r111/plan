// app/api/tasks/[id]/assignees/route.ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/shared/db/client";
import { taskAssignees } from "@/shared/db/schema";
import { EPICS_CACHE_TAG } from "@/entities/epic/epicRepository";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId required" }, { status: 422 });
    }
    await db
      .insert(taskAssignees)
      .values({ taskId: Number(id), userId: Number(userId) })
      .onConflictDoNothing();
    revalidateTag(EPICS_CACHE_TAG, "default");
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}