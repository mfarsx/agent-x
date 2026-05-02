import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  db: {
    user: { findFirst: vi.fn() },
    post: { findUnique: vi.fn(), create: vi.fn() },
    like: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
    repost: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
  },
}));

import { db } from "./client";
import { InvalidContentError, PostNotFoundError, UserNotFoundError } from "./errors";
import { createPostAsHandle, toggleLike, toggleRepost } from "./post";

type DbMock = {
  user: { findFirst: ReturnType<typeof vi.fn> };
  post: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  like: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  repost: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const dbMock = db as unknown as DbMock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPostAsHandle", () => {
  it("trims content and returns the created post", async () => {
    dbMock.user.findFirst.mockResolvedValue({ id: "user-1" });
    dbMock.post.create.mockResolvedValue({
      id: "post-1",
      content: "hello",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      author: { handle: "fatih" },
    });

    await expect(createPostAsHandle("fatih", "  hello  ")).resolves.toEqual({
      id: "post-1",
      content: "hello",
      createdAt: "2026-01-01T00:00:00.000Z",
      authorHandle: "fatih",
    });
    expect(dbMock.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { authorId: "user-1", kind: "POST", content: "hello" },
      }),
    );
  });

  it("rejects empty and oversized content before querying for a user", async () => {
    await expect(createPostAsHandle("fatih", "   ")).rejects.toBeInstanceOf(InvalidContentError);
    await expect(createPostAsHandle("fatih", "a".repeat(281))).rejects.toBeInstanceOf(
      InvalidContentError,
    );
    expect(dbMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("throws UserNotFoundError when the handle is unknown", async () => {
    dbMock.user.findFirst.mockResolvedValue(null);

    await expect(createPostAsHandle("ghost", "hello")).rejects.toBeInstanceOf(UserNotFoundError);
  });
});

describe("toggleLike", () => {
  beforeEach(() => {
    dbMock.user.findFirst.mockResolvedValue({ id: "user-1" });
    dbMock.post.findUnique.mockResolvedValue({ id: "post-1" });
    dbMock.like.count.mockResolvedValue(1);
  });

  it("creates a like when one does not exist", async () => {
    dbMock.like.findUnique.mockResolvedValue(null);

    await expect(toggleLike("fatih", "post-1")).resolves.toEqual({ active: true, count: 1 });
    expect(dbMock.like.create).toHaveBeenCalledWith({
      data: { userId: "user-1", postId: "post-1" },
    });
    expect(dbMock.like.delete).not.toHaveBeenCalled();
  });

  it("removes an existing like", async () => {
    dbMock.like.findUnique.mockResolvedValue({ id: "like-1" });
    dbMock.like.count.mockResolvedValue(0);

    await expect(toggleLike("fatih", "post-1")).resolves.toEqual({ active: false, count: 0 });
    expect(dbMock.like.delete).toHaveBeenCalledWith({
      where: { userId_postId: { userId: "user-1", postId: "post-1" } },
    });
    expect(dbMock.like.create).not.toHaveBeenCalled();
  });

  it("throws PostNotFoundError when the target post is missing", async () => {
    dbMock.post.findUnique.mockResolvedValue(null);

    await expect(toggleLike("fatih", "missing")).rejects.toBeInstanceOf(PostNotFoundError);
    expect(dbMock.like.findUnique).not.toHaveBeenCalled();
  });
});

describe("toggleRepost", () => {
  it("uses repost storage and returns the updated state", async () => {
    dbMock.user.findFirst.mockResolvedValue({ id: "user-1" });
    dbMock.post.findUnique.mockResolvedValue({ id: "post-1" });
    dbMock.repost.findUnique.mockResolvedValue(null);
    dbMock.repost.count.mockResolvedValue(2);

    await expect(toggleRepost("fatih", "post-1")).resolves.toEqual({ active: true, count: 2 });
    expect(dbMock.repost.create).toHaveBeenCalledWith({
      data: { userId: "user-1", postId: "post-1" },
    });
  });
});
