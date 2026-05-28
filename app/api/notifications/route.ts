import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createNotification,
  listNotifications,
  markNotificationsRead,
} from "@/entities/management/managementRepository";
import { getEpicById } from "@/entities/epic/epicRepository";
import { getOperativeTaskById } from "@/entities/operative/operativeRepository";
import { getTaskById } from "@/entities/task/taskRepository";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import { authErrorToResponse, requireAdminSession, requireWorkspaceAccess } from "@/shared/lib/route-auth";
import { canAccessTask, canAccessUser, filterEpicsByAccess, type WorkspaceAccessScope } from "@/shared/lib/access-scope";
import type { DbNotification } from "@/shared/types";

export const dynamic = "force-dynamic";

const CreateNotificationSchema = z.object({
  recipientUserId: z.string().nullable().optional(),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(1000),
  kind: z.string().max(40).optional(),
  entityType: z.string().max(80).nullable().optional(),
  entityId: z.union([z.string(), z.number()]).nullable().optional(),
});

const MarkReadSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

async function canAccessNotification(scope: WorkspaceAccessScope, notification: DbNotification) {
  if (!scope.isVariableRestricted) return true;
  const entityId = Number(notification.entityId);
  if (!Number.isInteger(entityId) || entityId <= 0) return notification.entityType !== "personal_plan_completion";

  if (notification.entityType === "task") {
    const task = await getTaskById(entityId);
    return !!task && canAccessTask(scope, task);
  }

  if (notification.entityType === "epic") {
    const epic = await getEpicById(entityId);
    return !!epic && filterEpicsByAccess([epic], scope).length > 0;
  }

  if (notification.entityType === "operative_task") {
    const task = await getOperativeTaskById(entityId);
    if (!task) return false;
    const owner = await getUserWithMetaById(task.userId);
    return !!owner && canAccessUser(scope, owner);
  }

  return notification.entityType !== "personal_plan_completion";
}

export async function GET() {
  try {
    const scope = await requireWorkspaceAccess();
    const personal = await listNotifications(scope.session.user.id);
    const global = await listNotifications(null);
    const visible = (
      await Promise.all([...personal, ...global].map(async (notification) => (
        await canAccessNotification(scope, notification) ? notification : null
      )))
    ).filter((notification): notification is DbNotification => notification !== null);
    return NextResponse.json({
      ok: true,
      data: visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50),
    });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminSession();
    const parsed = CreateNotificationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }
    const notification = await createNotification(parsed.data);
    return NextResponse.json({ ok: true, data: notification }, { status: 201 });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireWorkspaceAccess();
    const parsed = MarkReadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
    }
    await markNotificationsRead(parsed.data.ids);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
