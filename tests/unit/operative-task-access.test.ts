import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/operative-tasks/route";
import { PATCH } from "@/app/api/operative-tasks/[id]/route";
import {
  createOperativeTask,
  getOperativeTaskById,
  updateOperativeTaskDueDate,
  updateOperativeTaskStatus,
} from "@/entities/operative/operativeRepository";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import { writeAuditLog } from "@/shared/lib/audit";
import { requireWorkspaceAccess } from "@/shared/lib/route-auth";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/shared/server/eventBus", () => ({
  broadcast: vi.fn(),
}));

vi.mock("@/shared/lib/route-auth", () => ({
  requireWorkspaceAccess: vi.fn(),
  requireAdminSession: vi.fn(),
  authErrorToResponse: vi.fn(() => null),
}));

vi.mock("@/shared/lib/access-scope", () => ({
  canAccessUser: vi.fn(() => true),
}));

vi.mock("@/shared/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/shared/db/client", () => ({
  db: {},
}));

vi.mock("@/entities/user/userRepository", () => ({
  getUserWithMetaById: vi.fn(),
}));

vi.mock("@/entities/operative/operativeRepository", () => ({
  createOperativeTask: vi.fn(),
  getOperativeTaskById: vi.fn(),
  updateOperativeTaskStatus: vi.fn(),
  updateOperativeTaskDueDate: vi.fn(),
}));

const mockedRequireWorkspaceAccess = vi.mocked(requireWorkspaceAccess);
const mockedCreateOperativeTask = vi.mocked(createOperativeTask);
const mockedGetOperativeTaskById = vi.mocked(getOperativeTaskById);
const mockedUpdateOperativeTaskStatus = vi.mocked(updateOperativeTaskStatus);
const mockedUpdateOperativeTaskDueDate = vi.mocked(updateOperativeTaskDueDate);
const mockedGetUserWithMetaById = vi.mocked(getUserWithMetaById);
const mockedWriteAuditLog = vi.mocked(writeAuditLog);

function scope(role: "admin" | "member", profileId: number | null) {
  return {
    session: {
      user: { id: `${role}-auth`, role, profileId, name: role },
    },
    profile: profileId == null ? null : { id: profileId },
    isAdmin: role === "admin",
    groupKey: null,
    isVariableRestricted: false,
  } as Awaited<ReturnType<typeof requireWorkspaceAccess>>;
}

type TestTask = {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: "todo" | "in_progress" | "done";
  sortOrder: number;
  order: number;
  createdAt: string;
  updatedAt: string;
  subtasks: unknown[];
  comments: unknown[];
  progress: { done: number; total: number };
};

function task(userId: number, overrides: Partial<TestTask> = {}): TestTask {
  return {
    id: 5,
    userId,
    title: "Оперативная задача",
    description: null,
    dueDate: null,
    status: "todo" as const,
    sortOrder: 0,
    order: 0,
    createdAt: "2026-05-31T08:00:00.000Z",
    updatedAt: "2026-05-31T08:00:00.000Z",
    subtasks: [],
    comments: [],
    progress: { done: 0, total: 0 },
    ...overrides,
  };
}

describe("operative task access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetUserWithMetaById.mockResolvedValue({ id: 42 } as Awaited<ReturnType<typeof getUserWithMetaById>>);
    mockedCreateOperativeTask.mockImplementation(async (input) =>
      task(input.userId, input) as Awaited<ReturnType<typeof createOperativeTask>>,
    );
    mockedUpdateOperativeTaskStatus.mockResolvedValue(task(42, { status: "done" }) as Awaited<ReturnType<typeof updateOperativeTaskStatus>>);
    mockedUpdateOperativeTaskDueDate.mockResolvedValue(task(42) as Awaited<ReturnType<typeof updateOperativeTaskDueDate>>);
  });

  it("allows a member to create an operative task only for their own profile", async () => {
    mockedRequireWorkspaceAccess.mockResolvedValue(scope("member", 42));

    const response = await POST(new Request("http://localhost/api/operative-tasks", {
      method: "POST",
      body: JSON.stringify({ userId: 42, title: "Своя задача" }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(mockedCreateOperativeTask).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      title: "Своя задача",
    }));
    expect(mockedWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actor: { userId: "member-auth", role: "member" },
      action: "create",
      entityType: "operative_task",
      metadata: expect.objectContaining({ mode: "self", targetUserId: 42 }),
    }));
  });

  it("rejects a member creating an operative task for another user", async () => {
    mockedRequireWorkspaceAccess.mockResolvedValue(scope("member", 42));

    const response = await POST(new Request("http://localhost/api/operative-tasks", {
      method: "POST",
      body: JSON.stringify({ userId: 77, title: "Чужая задача" }),
    }));

    expect(response.status).toBe(403);
    expect(mockedCreateOperativeTask).not.toHaveBeenCalled();
    expect(mockedWriteAuditLog).not.toHaveBeenCalled();
  });

  it("allows an admin to create an operative task for any user", async () => {
    mockedRequireWorkspaceAccess.mockResolvedValue(scope("admin", null));

    const response = await POST(new Request("http://localhost/api/operative-tasks", {
      method: "POST",
      body: JSON.stringify({ userId: 77, title: "Админская задача" }),
    }));

    expect(response.status).toBe(201);
    expect(mockedCreateOperativeTask).toHaveBeenCalledWith(expect.objectContaining({
      userId: 77,
      title: "Админская задача",
    }));
    expect(mockedWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actor: { userId: "admin-auth", role: "admin" },
      metadata: expect.objectContaining({ mode: "admin_for_user", targetUserId: 77 }),
    }));
  });

  it("rejects member status changes on someone else's operative task", async () => {
    mockedRequireWorkspaceAccess.mockResolvedValue(scope("member", 42));
    mockedGetOperativeTaskById.mockResolvedValue(task(77) as Awaited<ReturnType<typeof getOperativeTaskById>>);

    const response = await PATCH(
      new Request("http://localhost/api/operative-tasks/5", {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      }),
      { params: Promise.resolve({ id: "5" }) },
    );

    expect(response.status).toBe(403);
    expect(mockedUpdateOperativeTaskStatus).not.toHaveBeenCalled();
    expect(mockedWriteAuditLog).not.toHaveBeenCalled();
  });

  it("audits before and after snapshots for member status changes on own task", async () => {
    mockedRequireWorkspaceAccess.mockResolvedValue(scope("member", 42));
    mockedGetOperativeTaskById.mockResolvedValue(task(42) as Awaited<ReturnType<typeof getOperativeTaskById>>);

    const response = await PATCH(
      new Request("http://localhost/api/operative-tasks/5", {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      }),
      { params: Promise.resolve({ id: "5" }) },
    );

    expect(response.status).toBe(200);
    expect(mockedUpdateOperativeTaskStatus).toHaveBeenCalledWith(5, "done");
    expect(mockedWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actor: { userId: "member-auth", role: "member" },
      action: "update_status",
      entityType: "operative_task",
      before: expect.objectContaining({ userId: 42, status: "todo" }),
      after: expect.objectContaining({ userId: 42, status: "done" }),
      metadata: expect.objectContaining({
        targetUserId: 42,
        changedFields: ["status"],
        status: { from: "todo", to: "done" },
      }),
    }));
  });
});
