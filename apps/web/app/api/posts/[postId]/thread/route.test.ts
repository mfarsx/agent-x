import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ThreadView } from "@agent-social/db";

vi.mock("@agent-social/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agent-social/db")>();
  return {
    ...actual,
    getThread: vi.fn(),
  };
});

vi.mock("../../../../../lib/session", () => ({
  getCurrentHandle: vi.fn(),
}));

import { getThread } from "@agent-social/db";
import { getCurrentHandle } from "../../../../../lib/session";
import { GET } from "./route";

const thread = {
  parent: null,
  post: {
    id: "post-1",
    kind: "POST",
    content: "hello",
    createdAt: "2026-01-01T00:00:00.000Z",
    author: { id: "u1", handle: "fatih", name: "Fatih", image: null, isAgent: false },
    parent: null,
    quotedPost: null,
    counts: { likes: 0, reposts: 0, replies: 0 },
    viewer: { liked: false, reposted: false },
  },
  replies: [],
} satisfies ThreadView;

describe("GET /api/posts/[postId]/thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentHandle).mockResolvedValue("fatih");
    vi.mocked(getThread).mockResolvedValue(thread);
  });

  it("returns the thread for the current viewer", async () => {
    const res = await GET(new NextRequest("http://localhost/api/posts/post-1/thread"), {
      params: Promise.resolve({ postId: "post-1" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ post: { id: "post-1" }, replies: [] });
    expect(getThread).toHaveBeenCalledWith("post-1", { viewerHandle: "fatih" });
  });

  it("trims route post ids before loading the thread", async () => {
    const res = await GET(new NextRequest("http://localhost/api/posts/post-1/thread"), {
      params: Promise.resolve({ postId: "  post-1  " }),
    });

    expect(res.status).toBe(200);
    expect(getThread).toHaveBeenCalledWith("post-1", { viewerHandle: "fatih" });
  });

  it("returns 404 for blank route post ids", async () => {
    const res = await GET(new NextRequest("http://localhost/api/posts/%20/thread"), {
      params: Promise.resolve({ postId: "   " }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "post_not_found" });
    expect(getCurrentHandle).not.toHaveBeenCalled();
    expect(getThread).not.toHaveBeenCalled();
  });

  it("returns 404 when the thread does not exist", async () => {
    vi.mocked(getThread).mockResolvedValueOnce(null);

    const res = await GET(new NextRequest("http://localhost/api/posts/missing/thread"), {
      params: Promise.resolve({ postId: "missing" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "post_not_found" });
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(getThread).mockRejectedValueOnce(new Error("db down"));

    const res = await GET(new NextRequest("http://localhost/api/posts/post-1/thread"), {
      params: Promise.resolve({ postId: "post-1" }),
    });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "failed_to_fetch_thread" });
  });
});
