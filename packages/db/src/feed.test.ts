import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  db: {
    user: { findFirst: vi.fn() },
    post: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

import { db } from "./client";
import { getLatestFeed, getProfileFeed, getThread } from "./feed";

type DbMock = {
  user: { findFirst: ReturnType<typeof vi.fn> };
  post: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
};

const dbMock = db as unknown as DbMock;

function postFixture(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: "POST",
    content: `content ${id}`,
    createdAt: new Date(`2026-01-0${id.slice(-1)}T00:00:00.000Z`),
    _count: { likes: 0, reposts: 0, replies: 0 },
    author: { id: "author-1", handle: "author", name: "Author", image: null, isAgent: false },
    parent: null,
    quotedPost: null,
    likes: [],
    reposts: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.post.findMany.mockResolvedValue([]);
  dbMock.post.findUnique.mockResolvedValue(null);
});

describe("getLatestFeed", () => {
  it("clamps the requested limit and asks for one extra post", async () => {
    await getLatestFeed({ limit: 999 });

    expect(dbMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
      }),
    );
  });

  it("returns a next cursor when more posts are available", async () => {
    dbMock.post.findMany.mockResolvedValue([
      postFixture("p1"),
      postFixture("p2"),
      postFixture("p3"),
    ]);

    await expect(getLatestFeed({ limit: 2 })).resolves.toMatchObject({
      items: [{ id: "p1" }, { id: "p2" }],
      nextCursor: "p2",
    });
  });

  it("passes cursor pagination options to Prisma", async () => {
    await getLatestFeed({ cursor: "cursor-1", limit: 5 });

    expect(dbMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        cursor: { id: "cursor-1" },
        skip: 1,
        take: 6,
      }),
    );
  });

  it("maps viewer like and repost state when a viewer handle resolves", async () => {
    dbMock.user.findFirst.mockResolvedValue({ id: "viewer-1" });
    dbMock.post.findMany.mockResolvedValue([
      postFixture("p1", {
        _count: { likes: 3, reposts: 2, replies: 7 },
        likes: [{ id: "like-1" }],
        reposts: [{ id: "repost-1" }],
      }),
    ]);

    const page = await getLatestFeed({ viewerHandle: "fatih" });

    expect(dbMock.user.findFirst).toHaveBeenCalledWith({
      where: { handle: "fatih" },
      select: { id: true },
    });
    expect(page.items[0]).toMatchObject({
      counts: { likes: 3, reposts: 2, replies: 7 },
      viewer: { liked: true, reposted: true },
    });
  });

  it("maps parent and quoted post summaries", async () => {
    dbMock.post.findMany.mockResolvedValue([
      postFixture("p1", {
        parent: {
          id: "parent-1",
          content: "parent content",
          author: { handle: "parent", name: "Parent", isAgent: false },
        },
        quotedPost: {
          id: "quote-1",
          content: "quoted content",
          author: { handle: "quote", name: "Quote", isAgent: true },
        },
      }),
    ]);

    const page = await getLatestFeed();

    expect(page.items[0]).toMatchObject({
      parent: { id: "parent-1", author: { handle: "parent" } },
      quotedPost: { id: "quote-1", author: { isAgent: true } },
      viewer: { liked: false, reposted: false },
    });
  });

  it("uses anonymous viewer state when a handle does not resolve", async () => {
    dbMock.user.findFirst.mockResolvedValue(null);
    dbMock.post.findMany.mockResolvedValue([
      postFixture("p1", {
        likes: [{ id: "like-1" }],
        reposts: [{ id: "repost-1" }],
      }),
    ]);

    const page = await getLatestFeed({ viewerHandle: "ghost", limit: -10 });

    expect(dbMock.post.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    expect(page.items[0]?.viewer).toEqual({ liked: false, reposted: false });
  });

  it("filters to agent authors when agentAuthorsOnly is set", async () => {
    dbMock.post.findMany.mockResolvedValue([]);
    await getLatestFeed({ agentAuthorsOnly: true });
    expect(dbMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { author: { isAgent: true } },
      }),
    );
  });

  it("filters by hyphenated topic slug on post content", async () => {
    dbMock.post.findMany.mockResolvedValue([]);
    await getLatestFeed({ topicSlug: "semantic-memory" });
    expect(dbMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { content: { contains: "semantic", mode: "insensitive" } },
            { content: { contains: "memory", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("combines agent filter with topic slug", async () => {
    dbMock.post.findMany.mockResolvedValue([]);
    await getLatestFeed({ agentAuthorsOnly: true, topicSlug: "agent-replies" });
    expect(dbMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { author: { isAgent: true } },
            {
              AND: [
                { content: { contains: "agent", mode: "insensitive" } },
                { content: { contains: "replies", mode: "insensitive" } },
              ],
            },
          ],
        },
      }),
    );
  });

  it("filters by search query on content or author fields", async () => {
    dbMock.post.findMany.mockResolvedValue([]);
    await getLatestFeed({ searchQuery: "scout" });
    expect(dbMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { content: { contains: "scout", mode: "insensitive" } },
            { author: { handle: { contains: "scout", mode: "insensitive" } } },
            { author: { name: { contains: "scout", mode: "insensitive" } } },
          ],
        },
      }),
    );
  });

  it("combines search with agent filter", async () => {
    dbMock.post.findMany.mockResolvedValue([]);
    await getLatestFeed({ agentAuthorsOnly: true, searchQuery: "hello" });
    expect(dbMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { author: { isAgent: true } },
            {
              OR: [
                { content: { contains: "hello", mode: "insensitive" } },
                { author: { handle: { contains: "hello", mode: "insensitive" } } },
                { author: { name: { contains: "hello", mode: "insensitive" } } },
              ],
            },
          ],
        },
      }),
    );
  });
});

describe("getProfileFeed", () => {
  it("scopes posts to the profile author", async () => {
    dbMock.user.findFirst.mockResolvedValue({ id: "user-scout" });
    dbMock.post.findMany.mockResolvedValue([postFixture("p1")]);

    await getProfileFeed("scout_ai", { limit: 10 });

    expect(dbMock.user.findFirst).toHaveBeenCalledWith({
      where: { handle: "scout_ai" },
      select: { id: true },
    });
    expect(dbMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: "user-scout" },
        take: 11,
      }),
    );
  });

  it("returns null when handle does not exist", async () => {
    dbMock.user.findFirst.mockResolvedValue(null);

    await expect(getProfileFeed("nope")).resolves.toBeNull();
    expect(dbMock.post.findMany).not.toHaveBeenCalled();
  });
});

describe("getThread", () => {
  it("returns the selected post, parent, and chronological replies", async () => {
    dbMock.user.findFirst.mockResolvedValue({ id: "viewer-1" });
    dbMock.post.findUnique
      .mockResolvedValueOnce(
        postFixture("p2", {
          kind: "REPLY",
          parent: {
            id: "p1",
            content: "parent summary",
            author: { handle: "parent", name: "Parent", isAgent: false },
          },
          likes: [{ id: "like-1" }],
        }),
      )
      .mockResolvedValueOnce(postFixture("p1", { content: "parent body" }));
    dbMock.post.findMany.mockResolvedValue([postFixture("p3", { kind: "REPLY" })]);

    await expect(getThread("p2", { viewerHandle: "fatih" })).resolves.toMatchObject({
      parent: { id: "p1", content: "parent body" },
      post: { id: "p2", kind: "REPLY", viewer: { liked: true, reposted: false } },
      replies: [{ id: "p3", kind: "REPLY" }],
    });
    expect(dbMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentId: "p2" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("returns null when the selected post does not exist", async () => {
    dbMock.post.findUnique.mockResolvedValue(null);

    await expect(getThread("missing")).resolves.toBeNull();
    expect(dbMock.post.findMany).not.toHaveBeenCalled();
  });
});
