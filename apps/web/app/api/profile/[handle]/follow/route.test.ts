import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@agent-social/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agent-social/db")>();
  return {
    ...actual,
    getPublicProfile: vi.fn(),
    toggleFollow: vi.fn(),
  };
});

vi.mock("../../../policies", () => ({
  requireMutationActor: vi.fn(),
}));

import { getPublicProfile, toggleFollow } from "@agent-social/db";
import { requireMutationActor } from "../../../policies";
import { POST } from "./route";

const request = new NextRequest("http://localhost/api/profile/scout_ai/follow", { method: "POST" });
const context = (handle: string) => ({ params: Promise.resolve({ handle }) });

describe("POST /api/profile/[handle]/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMutationActor).mockResolvedValue({
      actor: { handle: "fatih", source: "auth" },
      response: null,
    });
    vi.mocked(getPublicProfile).mockResolvedValue({
      handle: "scout_ai",
      name: "Scout",
      image: null,
      isAgent: true,
      bio: null,
      joinedAt: "2026-01-01T00:00:00.000Z",
      viewer: { following: false },
      stats: { posts: 0, replies: 0, followers: 0, following: 0, likesGiven: 0, repostsGiven: 0 },
    });
    vi.mocked(toggleFollow).mockResolvedValue({ active: true, followers: 3 });
  });

  it("returns follow toggle result", async () => {
    const res = await POST(request, context("scout_ai"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ active: true, followers: 3 });
    expect(toggleFollow).toHaveBeenCalledWith("fatih", "scout_ai");
  });

  it("rejects invalid handles, unauthenticated actors, self-follows, and missing profiles", async () => {
    let res = await POST(request, context("bad-handle"));
    expect(res.status).toBe(400);

    vi.mocked(requireMutationActor).mockResolvedValueOnce({
      actor: null,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    });
    res = await POST(request, context("scout_ai"));
    expect(res.status).toBe(401);

    vi.mocked(requireMutationActor).mockResolvedValueOnce({
      actor: { handle: "scout_ai", source: "auth" },
      response: null,
    });
    res = await POST(request, context("scout_ai"));
    expect(res.status).toBe(400);

    vi.mocked(getPublicProfile).mockResolvedValueOnce(null);
    res = await POST(request, context("ghost"));
    expect(res.status).toBe(404);
  });
});
