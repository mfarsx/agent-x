import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@agent-social/db", () => ({
  db: {
    post: { findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("./action-log.js", () => ({
  logAction: vi.fn(),
}));

vi.mock("./memory.js", () => ({
  addMemory: vi.fn(),
  getRelevantMemories: vi.fn(),
}));

vi.mock("./ollama.js", () => ({
  ollamaChat: vi.fn(),
}));

import { db } from "@agent-social/db";
import { logAction } from "./action-log.js";
import { doPost, doReply } from "./actions.js";
import { getRelevantMemories } from "./memory.js";
import { ollamaChat } from "./ollama.js";

type DbMock = {
  post: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

const dbMock = db as unknown as DbMock;
const baseOptions = {
  agentId: "agent-1",
  agentHandle: "scout_ai",
  systemPrompt: "be helpful",
  dryRun: true,
};
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(getRelevantMemories).mockResolvedValue("");
  vi.mocked(ollamaChat).mockResolvedValue("fresh generated post");
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("doPost", () => {
  it("logs a dry-run post without creating a database row", async () => {
    dbMock.post.findMany.mockResolvedValue([]);

    await doPost(baseOptions);

    expect(dbMock.post.create).not.toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "post",
      null,
      null,
      "dry_run",
      expect.objectContaining({ content: "fresh generated post" }),
      null,
    );
  });

  it("falls back after repeated similar LLM drafts", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    dbMock.post.findMany.mockResolvedValue([{ content: "same old thought" }]);
    vi.mocked(ollamaChat).mockResolvedValue("same old thought");

    await doPost(baseOptions);

    expect(ollamaChat).toHaveBeenCalledTimes(3);
    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "post",
      null,
      null,
      "dry_run",
      expect.objectContaining({
        content: expect.stringContaining("Small note on"),
      }),
      null,
    );
  });
});

describe("doReply", () => {
  it("skips when no candidate is eligible", async () => {
    dbMock.post.findMany
      .mockResolvedValueOnce([
        {
          id: "post-1",
          authorId: "human-1",
          content: "hello",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          author: { handle: "fatih", name: "Fatih", isAgent: false },
          replies: [{ authorId: "agent-1", content: "already replied" }],
        },
      ])
      .mockResolvedValueOnce([]);

    await doReply(baseOptions);

    expect(ollamaChat).not.toHaveBeenCalled();
    expect(dbMock.post.create).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
  });

  it("creates and logs a reply for an eligible human question", async () => {
    dbMock.post.findMany
      .mockResolvedValueOnce([
        {
          id: "post-1",
          authorId: "human-1",
          content: "How do you test agents?",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          author: { handle: "fatih", name: "Fatih", isAgent: false },
          replies: [],
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    dbMock.post.create.mockResolvedValue({ id: "reply-1" });
    vi.mocked(ollamaChat).mockResolvedValue("  With focused regression checks.  ");

    await doReply({ ...baseOptions, dryRun: false });

    expect(dbMock.post.create).toHaveBeenCalledWith({
      data: {
        authorId: "agent-1",
        kind: "REPLY",
        content: "With focused regression checks.",
        parentId: "post-1",
      },
    });
    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "reply",
      "post",
      "reply-1",
      "ok",
      { parentPostId: "post-1", content: "With focused regression checks." },
      { postId: "reply-1" },
    );
  });
});
