import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@agent-social/db", () => ({
  db: {
    agentMemory: { create: vi.fn() },
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("./ollama.js", () => ({
  ollamaEmbed: vi.fn(),
}));

import { db } from "@agent-social/db";
import { addMemory, getRecentMemories, getRelevantMemories } from "./memory.js";
import { ollamaEmbed } from "./ollama.js";

type DbMock = {
  agentMemory: { create: ReturnType<typeof vi.fn> };
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as DbMock;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ollamaEmbed).mockResolvedValue([0.1, 0.2, 0.3]);
  dbMock.agentMemory.create.mockResolvedValue({ id: "memory-1" });
});

describe("addMemory", () => {
  it("stores memory content and writes a vector when embedding succeeds", async () => {
    await addMemory("agent-1", "remember this", { type: "fact" });

    expect(dbMock.agentMemory.create).toHaveBeenCalledWith({
      data: { agentId: "agent-1", content: "remember this", metadata: { type: "fact" } },
      select: { id: true },
    });
    expect(dbMock.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "AgentMemory"'),
      "[0.1,0.2,0.3]",
      "memory-1",
    );
  });

  it("keeps the memory row when embedding fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(ollamaEmbed).mockRejectedValue(new Error("ollama down"));

    await addMemory("agent-1", "remember without vector", { source: "seed" });

    expect(dbMock.agentMemory.create).toHaveBeenCalled();
    expect(dbMock.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Embedding failed"), "ollama down");
  });
});

describe("memory retrieval", () => {
  it("returns recent durable memories with the durable metadata filter", async () => {
    dbMock.$queryRawUnsafe.mockResolvedValue([{ content: "fact one" }, { content: "fact two" }]);

    await expect(getRecentMemories("agent-1", 2)).resolves.toBe("fact one\nfact two");
    expect(dbMock.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("metadata"),
      "agent-1",
      2,
    );
  });

  it("falls back to recent memories when query embedding fails", async () => {
    vi.mocked(ollamaEmbed).mockRejectedValue(new Error("embed failed"));
    dbMock.$queryRawUnsafe.mockResolvedValue([{ content: "recent fallback" }]);

    await expect(getRelevantMemories("agent-1", "topic", 1)).resolves.toBe("recent fallback");
    expect(dbMock.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY "createdAt" DESC'),
      "agent-1",
      1,
    );
  });

  it("falls back to recent memories when vector search returns no rows", async () => {
    dbMock.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ content: "durable fallback" }]);

    await expect(getRelevantMemories("agent-1", "topic", 1)).resolves.toBe("durable fallback");
    expect(dbMock.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('embedding" <=> $2::vector'),
      "agent-1",
      "[0.1,0.2,0.3]",
      1,
    );
  });
});
