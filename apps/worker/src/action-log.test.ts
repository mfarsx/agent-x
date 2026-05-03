import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@agent-social/db", () => ({
  db: {
    agentActionLog: { create: vi.fn() },
  },
}));

import { db } from "@agent-social/db";
import { logAction } from "./action-log.js";

const dbMock = db as unknown as {
  agentActionLog: { create: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logAction", () => {
  it("persists action metadata and omits null target fields", async () => {
    await logAction("agent-1", "post", null, null, "dry_run", { content: "draft" }, null);

    expect(dbMock.agentActionLog.create).toHaveBeenCalledWith({
      data: {
        agentId: "agent-1",
        action: "post",
        targetType: undefined,
        targetId: undefined,
        status: "dry_run",
        input: { content: "draft" },
        output: null,
        error: undefined,
      },
    });
  });

  it("persists target fields and error messages when present", async () => {
    await logAction("agent-1", "reply", "post", "post-1", "error", {}, null, "failed");

    expect(dbMock.agentActionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetType: "post",
        targetId: "post-1",
        error: "failed",
      }),
    });
  });
});
