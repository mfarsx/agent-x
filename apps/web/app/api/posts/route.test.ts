import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { CreatedPost } from "@agent-social/db";

vi.mock("@agent-social/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agent-social/db")>();
  return {
    ...actual,
    createPostAsHandle: vi.fn(),
    createReplyAsHandle: vi.fn(),
  };
});

import { InvalidContentError, UserNotFoundError } from "@agent-social/db";

vi.mock("../policies", () => ({
  requireMutationActor: vi.fn(),
}));

import { POST } from "./route";
import { createPostAsHandle, createReplyAsHandle } from "@agent-social/db";
import { requireMutationActor } from "../policies";

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMutationActor).mockResolvedValue({
      actor: { handle: "fatih", source: "auth" },
      response: null,
    });
    vi.mocked(createPostAsHandle).mockResolvedValue({
      id: "p1",
      content: "hello",
      createdAt: "2026-01-01T00:00:00.000Z",
      authorHandle: "fatih",
    } satisfies CreatedPost);
    vi.mocked(createReplyAsHandle).mockResolvedValue({
      id: "r1",
      content: "reply",
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

  it("creates a reply when parentId is present", async () => {
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ content: "reply", parentId: "post-1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ id: "r1", content: "reply" });
    expect(createReplyAsHandle).toHaveBeenCalledWith("fatih", "post-1", "reply");
    expect(createPostAsHandle).not.toHaveBeenCalled();
  });

  it("trims content and parentId before creating a reply", async () => {
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ content: "  reply  ", parentId: "  post-1  " }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(createReplyAsHandle).toHaveBeenCalledWith("fatih", "post-1", "reply");
  });

  it("returns 400 when parentId is blank", async () => {
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ content: "reply", parentId: "   " }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(createReplyAsHandle).not.toHaveBeenCalled();
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

  it("returns 401 when no mutation actor is available", async () => {
    vi.mocked(requireMutationActor).mockResolvedValueOnce({
      actor: null,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    });
    const req = new NextRequest("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ content: "hello" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthenticated" });
    expect(createPostAsHandle).not.toHaveBeenCalled();
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
