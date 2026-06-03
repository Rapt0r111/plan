import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/personal-plan/user-order/route";
import { reorderPersonalPlanUsers } from "@/entities/personal-plan/personalPlanRepository";
import { requireAdminSession } from "@/shared/lib/route-auth";
import { writeAuditLog } from "@/shared/lib/audit";
import { broadcast } from "@/shared/server/eventBus";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/server/eventBus", () => ({ broadcast: vi.fn() }));
vi.mock("@/shared/lib/route-auth", () => ({
  requireAdminSession: vi.fn(),
  authErrorToResponse: vi.fn(() => null),
}));
vi.mock("@/shared/lib/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/entities/personal-plan/personalPlanRepository", () => ({ reorderPersonalPlanUsers: vi.fn() }));

const mockedRequireAdminSession = vi.mocked(requireAdminSession);
const mockedReorder = vi.mocked(reorderPersonalPlanUsers);
const mockedWriteAuditLog = vi.mocked(writeAuditLog);
const mockedBroadcast = vi.mocked(broadcast);

describe("personal plan user order route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as Awaited<ReturnType<typeof requireAdminSession>>);
    mockedReorder.mockResolvedValue([]);
  });

  it("persists admin reorder of permanent personnel blocks", async () => {
    const response = await PATCH(new Request("http://localhost/api/personal-plan/user-order", {
      method: "PATCH",
      body: JSON.stringify({ userIds: [3, 1, 2] }),
    }));

    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(response.status).toBe(200);
    expect(mockedReorder).toHaveBeenCalledWith([3, 1, 2]);
    expect(mockedBroadcast).toHaveBeenCalledWith("personal_plan:updated", expect.objectContaining({ action: "user_reorder", userIds: [3, 1, 2] }));
    expect(mockedWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actor: { userId: "admin-1", role: "admin" },
      action: "reorder",
      entityType: "personal_plan_user_order",
    }));
  });

  it("rejects a single-item order payload", async () => {
    const response = await PATCH(new Request("http://localhost/api/personal-plan/user-order", {
      method: "PATCH",
      body: JSON.stringify({ userIds: [7] }),
    }));

    expect(response.status).toBe(422);
    expect(mockedReorder).not.toHaveBeenCalled();
  });
});
