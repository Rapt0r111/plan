import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/personal-plan/[id]/completion/route";
import {
  getPersonalPlanItemById,
  setPersonalPlanCompletion,
} from "@/entities/personal-plan/personalPlanRepository";
import { writeAuditLog } from "@/shared/lib/audit";
import { optionalSession } from "@/shared/lib/route-auth";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/shared/server/eventBus", () => ({
  broadcast: vi.fn(),
}));

vi.mock("@/shared/lib/route-auth", () => ({
  optionalSession: vi.fn(),
  authErrorToResponse: vi.fn(() => null),
}));

vi.mock("@/shared/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/entities/personal-plan/personalPlanRepository", () => ({
  getPersonalPlanItemById: vi.fn(),
  setPersonalPlanCompletion: vi.fn(),
}));

const mockedOptionalSession = vi.mocked(optionalSession);
const mockedGetPersonalPlanItemById = vi.mocked(getPersonalPlanItemById);
const mockedSetPersonalPlanCompletion = vi.mocked(setPersonalPlanCompletion);
const mockedWriteAuditLog = vi.mocked(writeAuditLog);

describe("personal plan completion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPersonalPlanItemById.mockResolvedValue({
      id: 6,
      userId: 42,
      weekday: 1,
      title: "Проверка",
      description: null,
      startTime: "09:00",
      endTime: "10:00",
      color: "#8b5cf6",
      sortOrder: 0,
      createdAt: "2026-05-25T00:00:00.000Z",
      updatedAt: "2026-05-25T00:00:00.000Z",
    });
    mockedSetPersonalPlanCompletion.mockResolvedValue({
      id: 10,
      itemId: 6,
      date: "2026-05-25",
      completedByUserId: null,
      completedAt: "2026-05-25T09:00:00.000Z",
    });
  });

  it("allows an anonymous viewer to mark a task completed", async () => {
    mockedOptionalSession.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/personal-plan/6/completion", {
        method: "PATCH",
        body: JSON.stringify({ date: "2026-05-25", completed: true }),
      }),
      { params: Promise.resolve({ id: "6" }) },
    );

    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(response.status).toBe(200);
    expect(mockedSetPersonalPlanCompletion).toHaveBeenCalledWith({
      itemId: 6,
      date: "2026-05-25",
      completed: true,
      completedByUserId: null,
    });
    expect(mockedWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actor: { userId: null, role: "anonymous" },
      action: "complete",
      entityType: "personal_plan_completion",
      entityId: 6,
    }));
  });
});
