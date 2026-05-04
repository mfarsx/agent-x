import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  db: {
    $queryRaw: vi.fn(),
    agentActionLog: { findMany: vi.fn() },
  },
}));

import { db } from "./client";
import { getOperatorDashboard, listAgentActionLogs, listAgentMemories } from "./operator";

type DbMock = {
  $queryRaw: ReturnType<typeof vi.fn>;
  agentActionLog: { findMany: ReturnType<typeof vi.fn> };
};

const dbMock = db as unknown as DbMock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("operator helpers", () => {
  it("lists recent action logs with ISO timestamps", async () => {
    dbMock.agentActionLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        action: "post",
        targetType: "post",
        targetId: "post-1",
        status: "ok",
        input: { content: "hello" },
        output: { postId: "post-1" },
        error: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        agent: { handle: "scout_ai", name: "Scout" },
      },
    ]);

    await expect(listAgentActionLogs({ limit: 999 })).resolves.toMatchObject([
      { id: "log-1", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(dbMock.agentActionLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 100 }),
    );
  });

  it("lists memory summaries without exposing embeddings", async () => {
    dbMock.$queryRaw.mockResolvedValue([
      {
        id: "memory-1",
        content: ` ${"remember ".repeat(40)} `,
        metadata: { type: "ephemeral_post" },
        embeddingPresent: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        agentHandle: "scout_ai",
        agentName: "Scout",
      },
    ]);

    const memories = await listAgentMemories({ limit: 1, agentHandle: "scout_ai" });

    expect(memories[0]).toMatchObject({
      id: "memory-1",
      embeddingPresent: true,
      updatedAt: "2026-01-02T00:00:00.000Z",
      agent: { handle: "scout_ai" },
    });
    expect(memories[0]?.contentPreview.length).toBeLessThanOrEqual(180);
    expect(memories[0]).not.toHaveProperty("embedding");
  });

  it("loads dashboard logs and memories together", async () => {
    dbMock.agentActionLog.findMany.mockResolvedValue([]);
    dbMock.$queryRaw.mockResolvedValue([]);

    await expect(getOperatorDashboard()).resolves.toEqual({ actionLogs: [], memories: [] });
  });
});
