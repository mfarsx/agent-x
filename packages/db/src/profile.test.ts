import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  db: {
    user: { findFirst: vi.fn() },
    post: { count: vi.fn() },
    follow: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
    like: { count: vi.fn(), findMany: vi.fn() },
    repost: { count: vi.fn(), findMany: vi.fn() },
  },
}));

import { db } from "./client";
import { getPublicProfile, toggleFollow } from "./profile";

type DbMock = {
  user: { findFirst: ReturnType<typeof vi.fn> };
  post: { count: ReturnType<typeof vi.fn> };
  follow: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  like: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  repost: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

const dbMock = db as unknown as DbMock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPublicProfile", () => {
  it("returns follower stats and viewer follow state", async () => {
    dbMock.user.findFirst
      .mockResolvedValueOnce({
        id: "target-1",
        handle: "scout_ai",
        name: "Scout",
        image: null,
        isAgent: true,
        bio: "Agent profile",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        _count: { posts: 4 },
      })
      .mockResolvedValueOnce({ id: "viewer-1" });
    dbMock.post.count.mockResolvedValue(1);
    dbMock.follow.count.mockResolvedValueOnce(5).mockResolvedValueOnce(6);
    dbMock.like.count.mockResolvedValue(2);
    dbMock.repost.count.mockResolvedValue(3);
    dbMock.follow.findUnique.mockResolvedValue({ id: "follow-1" });

    await expect(getPublicProfile("scout_ai", "fatih")).resolves.toMatchObject({
      handle: "scout_ai",
      viewer: { following: true },
      stats: { posts: 4, replies: 1, followers: 5, following: 6, likesGiven: 2, repostsGiven: 3 },
    });
  });
});

describe("toggleFollow", () => {
  it("creates a follow when one does not exist", async () => {
    dbMock.user.findFirst
      .mockResolvedValueOnce({ id: "viewer-1" })
      .mockResolvedValueOnce({ id: "target-1" });
    dbMock.follow.findUnique.mockResolvedValue(null);
    dbMock.follow.count.mockResolvedValue(3);

    await expect(toggleFollow("fatih", "scout_ai")).resolves.toEqual({
      active: true,
      followers: 3,
    });
    expect(dbMock.follow.create).toHaveBeenCalledWith({
      data: { followerId: "viewer-1", followingId: "target-1" },
    });
    expect(dbMock.follow.delete).not.toHaveBeenCalled();
  });

  it("removes an existing follow", async () => {
    dbMock.user.findFirst
      .mockResolvedValueOnce({ id: "viewer-1" })
      .mockResolvedValueOnce({ id: "target-1" });
    dbMock.follow.findUnique.mockResolvedValue({ id: "follow-1" });
    dbMock.follow.count.mockResolvedValue(2);

    await expect(toggleFollow("fatih", "scout_ai")).resolves.toEqual({
      active: false,
      followers: 2,
    });
    expect(dbMock.follow.delete).toHaveBeenCalledWith({
      where: { followerId_followingId: { followerId: "viewer-1", followingId: "target-1" } },
    });
  });
});
