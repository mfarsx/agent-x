import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@agent-social/db", () => ({
  db: {
    post: { count: vi.fn(), findMany: vi.fn(), create: vi.fn() },
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
import { sanitize } from "./content-quality.js";
import { addMemory, getRelevantMemories } from "./memory.js";
import { ollamaChat } from "./ollama.js";

type DbMock = {
  post: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
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
  dbMock.post.count.mockReset();
  dbMock.post.findMany.mockReset();
  dbMock.post.create.mockReset();
  vi.mocked(logAction).mockReset();
  vi.mocked(addMemory).mockReset();
  vi.mocked(getRelevantMemories).mockReset();
  vi.mocked(ollamaChat).mockReset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  dbMock.post.count.mockResolvedValue(0);
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

  it("skips posts when quota is reached", async () => {
    process.env.WORKER_MAX_POSTS_PER_WINDOW = "1";
    dbMock.post.count.mockResolvedValue(1);
    dbMock.post.findMany.mockResolvedValue([]);

    await doPost(baseOptions);

    expect(dbMock.post.create).not.toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "post",
      null,
      null,
      "skipped_quota",
      expect.objectContaining({ quota: expect.objectContaining({ count: 1, max: 1 }) }),
      null,
    );
  });

  it("skips posts that trip the duplicate guard", async () => {
    dbMock.post.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ content: "fresh generated post" }]);

    await doPost(baseOptions);

    expect(dbMock.post.create).not.toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "post",
      null,
      null,
      "skipped_duplicate",
      expect.objectContaining({ duplicate: expect.objectContaining({ duplicateRisk: true }) }),
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

  it("creates a database post and writes memory when enabled", async () => {
    process.env.MEMORY_WRITE_POSTS = "1";
    dbMock.post.findMany.mockResolvedValue([{ content: "older update" }, { content: null }]);
    dbMock.post.create.mockResolvedValue({ id: "post-1" });

    await doPost({ ...baseOptions, dryRun: false });

    expect(dbMock.post.create).toHaveBeenCalledWith({
      data: {
        authorId: "agent-1",
        kind: "POST",
        content: "fresh generated post",
      },
    });
    expect(addMemory).toHaveBeenCalledWith("agent-1", "Posted: fresh generated post", {
      postId: "post-1",
      type: "ephemeral_post",
    });
    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "post",
      "post",
      "post-1",
      "ok",
      expect.objectContaining({ content: "fresh generated post" }),
      { postId: "post-1" },
    );
  });

  it("logs post errors without throwing", async () => {
    dbMock.post.findMany.mockRejectedValue(new Error("db down"));

    await expect(doPost(baseOptions)).resolves.toBeUndefined();

    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "post",
      null,
      null,
      "error",
      {},
      null,
      "db down",
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
    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "reply",
      null,
      null,
      "skipped_no_candidate",
      {},
      null,
    );
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

  it("sanitizes reply output like posts (quotes, whitespace, max length)", async () => {
    const rawReply = '  "Hello there."  ';
    const cleaned = sanitize(rawReply, 200);
    dbMock.post.findMany
      .mockResolvedValueOnce([
        {
          id: "post-1",
          authorId: "human-1",
          content: "Ping?",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          author: { handle: "fatih", name: "Fatih", isAgent: false },
          replies: [],
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    dbMock.post.create.mockResolvedValue({ id: "reply-2" });
    vi.mocked(ollamaChat).mockResolvedValue(rawReply);

    await doReply({ ...baseOptions, dryRun: false });

    expect(dbMock.post.create).toHaveBeenCalledWith({
      data: {
        authorId: "agent-1",
        kind: "REPLY",
        content: cleaned,
        parentId: "post-1",
      },
    });
  });

  it("logs a dry-run reply without creating a row", async () => {
    dbMock.post.findMany
      .mockResolvedValueOnce([
        {
          id: "post-1",
          authorId: "human-1",
          content: "What changed?",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          author: { handle: "fatih", name: null, isAgent: false },
          replies: [],
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ author: { handle: "ada" }, content: "Earlier reply" }])
      .mockResolvedValueOnce([]);
    vi.mocked(getRelevantMemories).mockResolvedValue("Remember context");
    vi.mocked(ollamaChat).mockResolvedValue("Dry reply");

    await doReply(baseOptions);

    expect(dbMock.post.create).not.toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "reply",
      "post",
      "post-1",
      "dry_run",
      { parentPostId: "post-1", content: "Dry reply" },
      null,
    );
  });

  it("skips empty generated replies", async () => {
    dbMock.post.findMany
      .mockResolvedValueOnce([
        {
          id: "post-1",
          authorId: "human-1",
          content: "hello?",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          author: { handle: "fatih", name: "Fatih", isAgent: false },
          replies: [],
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(ollamaChat).mockResolvedValue("   ");

    await doReply({ ...baseOptions, dryRun: false });

    expect(dbMock.post.create).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
  });

  it("writes reply memory when enabled", async () => {
    process.env.MEMORY_WRITE_REPLIES = "1";
    dbMock.post.findMany
      .mockResolvedValueOnce([
        {
          id: "post-1",
          authorId: "human-1",
          content: "How now?",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          author: { handle: "fatih", name: "Fatih", isAgent: false },
          replies: [],
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    dbMock.post.create.mockResolvedValue({ id: "reply-3" });
    vi.mocked(ollamaChat).mockResolvedValue("By keeping scope small.");

    await doReply({ ...baseOptions, dryRun: false });

    expect(addMemory).toHaveBeenCalledWith(
      "agent-1",
      "Replied to @fatih: By keeping scope small.",
      {
        postId: "reply-3",
        parentPostId: "post-1",
        type: "ephemeral_reply",
      },
    );
  });

  it("logs reply errors without throwing", async () => {
    dbMock.post.findMany.mockRejectedValue(new Error("reply db down"));

    await expect(doReply(baseOptions)).resolves.toBeUndefined();

    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "reply",
      null,
      null,
      "error",
      {},
      null,
      "reply db down",
    );
  });

  it("skips replies when quota is reached", async () => {
    process.env.WORKER_MAX_REPLIES_PER_WINDOW = "1";
    dbMock.post.count.mockResolvedValue(1);
    dbMock.post.findMany
      .mockResolvedValueOnce([
        {
          id: "post-1",
          authorId: "human-1",
          content: "How now?",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          author: { handle: "fatih", name: "Fatih", isAgent: false },
          replies: [],
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(ollamaChat).mockResolvedValue("A quota-aware reply.");

    await doReply({ ...baseOptions, dryRun: false });

    expect(dbMock.post.create).not.toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledWith(
      "agent-1",
      "reply",
      "post",
      "post-1",
      "skipped_quota",
      expect.objectContaining({ quota: expect.objectContaining({ count: 1, max: 1 }) }),
      null,
    );
  });
});
