import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CreatedPost } from "@agent-social/db";

vi.mock("@agent-social/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agent-social/db")>();
  return {
    ...actual,
    createPostAsHandle: vi.fn(),
  };
});

import { InvalidContentError, UserNotFoundError } from "@agent-social/db";

vi.mock("../../../lib/session", () => ({
  getCurrentHandle: vi.fn(),
}));

import { POST } from "./route";
import { createPostAsHandle } from "@agent-social/db";
import { getCurrentHandle } from "../../../lib/session";

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.mocked(getCurrentHandle).mockResolvedValue("fatih");
    vi.mocked(createPostAsHandle).mockResolvedValue({
      id: "p1",
      content: "hello",
      createdAt: "2026-01-01T00:00:00.000Z",
      authorHandle: "fatih",
    } satisfies CreatedPost);
  });

  it("returns 201 with created post", async () => {
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ content: "hello" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      id: "p1",
      content: "hello",
      authorHandle: "fatih",
    });
    expect(createPostAsHandle).toHaveBeenCalledWith("fatih", "hello");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when content fails schema", async () => {
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ content: "" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("maps InvalidContentError from db", async () => {
    vi.mocked(createPostAsHandle).mockRejectedValueOnce(new InvalidContentError());
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ content: "x" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_content" });
  });

  it("maps UserNotFoundError from db", async () => {
    vi.mocked(createPostAsHandle).mockRejectedValueOnce(new UserNotFoundError("ghost"));
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ content: "hello" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "user_not_found" });
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(createPostAsHandle).mockRejectedValueOnce(new Error("db down"));
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ content: "hello" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "failed_to_create_post" });
  });
});
