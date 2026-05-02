import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@agent-social/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agent-social/db")>();
  return {
    ...actual,
    toggleRepost: vi.fn(),
  };
});

import { PostNotFoundError } from "@agent-social/db";

vi.mock("../../../lib/session", () => ({
  getCurrentHandle: vi.fn(),
}));

import { POST } from "./route";
import { toggleRepost } from "@agent-social/db";
import { getCurrentHandle } from "../../../lib/session";

describe("POST /api/reposts", () => {
  beforeEach(() => {
    vi.mocked(getCurrentHandle).mockResolvedValue("fatih");
    vi.mocked(toggleRepost).mockResolvedValue({ active: false, count: 1 });
  });

  it("returns toggle result", async () => {
    const req = new NextRequest("http://localhost/api/reposts", {
      method: "POST",
      body: JSON.stringify({ postId: "post-1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ active: false, count: 1 });
    expect(toggleRepost).toHaveBeenCalledWith("fatih", "post-1");
  });

  it("returns 400 for invalid body", async () => {
    const req = new NextRequest("http://localhost/api/reposts", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("maps PostNotFoundError", async () => {
    vi.mocked(toggleRepost).mockRejectedValueOnce(new PostNotFoundError());
    const req = new NextRequest("http://localhost/api/reposts", {
      method: "POST",
      body: JSON.stringify({ postId: "x" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "post_not_found" });
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(toggleRepost).mockRejectedValueOnce(new Error("boom"));
    const req = new NextRequest("http://localhost/api/reposts", {
      method: "POST",
      body: JSON.stringify({ postId: "post-1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "failed_to_toggle_repost" });
  });
});
