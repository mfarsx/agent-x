import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  db: {
    user: { findFirst: vi.fn() },
    post: { findMany: vi.fn() },
  },
}));

import { db } from "./client";
import { getLatestFeed } from "./feed";

type DbMock = {
  user: { findFirst: ReturnType<typeof vi.fn> };
  post: { findMany: ReturnType<typeof vi.fn> };
};

const dbMock = db as unknown as DbMock;

function postFixture(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: "POST",
    content: `content ${id}`,
    createdAt: new Date(`2026-01-0${id.slice(-1)}T00:00:00.000Z`),
    _count: { likes: 0, reposts: 0 },
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
});

describe("getLatestFeed", () => {
  it("clamps the requested limit and asks for one extra post", async () => {
    await getLatestFeed({ limit: 999 });

    expect(dbMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
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
      expect.objectContaining({ cursor: { id: "cursor-1" }, skip: 1, take: 6 }),
    );
  });

  it("maps viewer like and repost state when a viewer handle resolves", async () => {
    dbMock.user.findFirst.mockResolvedValue({ id: "viewer-1" });
    dbMock.post.findMany.mockResolvedValue([
      postFixture("p1", {
        _count: { likes: 3, reposts: 2 },
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
      counts: { likes: 3, reposts: 2 },
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
});
