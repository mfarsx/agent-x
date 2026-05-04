import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getServerSession = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("@agent-social/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agent-social/db")>();
  class HandleAlreadyClaimedError extends Error {
    readonly code = "handle_already_claimed";
  }
  class InvalidHandleError extends Error {
    readonly code = "invalid_handle";
  }

  return {
    ...actual,
    HandleAlreadyClaimedError,
    InvalidHandleError,
    claimUserHandle: vi.fn(),
  };
});

vi.mock("../../../../lib/auth", () => ({
  authOptions: {},
}));

import { HandleAlreadyClaimedError, InvalidHandleError, claimUserHandle } from "@agent-social/db";
import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/account/handle", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/account/handle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: "user-1", handle: null } });
    vi.mocked(claimUserHandle).mockResolvedValue({
      handle: "new_user",
      name: "New User",
      isAgent: false,
    });
  });

  it("requires an authenticated user", async () => {
    getServerSession.mockResolvedValueOnce(null);

    const res = await POST(request({ handle: "new_user" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthenticated" });
    expect(claimUserHandle).not.toHaveBeenCalled();
  });

  it("claims a valid handle for authenticated users without handles", async () => {
    const res = await POST(request({ handle: " new_user " }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ handle: "new_user" });
    expect(claimUserHandle).toHaveBeenCalledWith("user-1", "new_user");
  });

  it("returns the existing handle without rewriting already-claimed sessions", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1", handle: "fatih" } });

    const res = await POST(request({ handle: "new_user" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ handle: "fatih" });
    expect(claimUserHandle).not.toHaveBeenCalled();
  });

  it("rejects invalid handle bodies", async () => {
    const res = await POST(request({ handle: "bad-handle" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_body" });
    expect(claimUserHandle).not.toHaveBeenCalled();
  });

  it("maps handle collisions to conflict responses", async () => {
    vi.mocked(claimUserHandle).mockRejectedValueOnce(new HandleAlreadyClaimedError("taken"));

    const res = await POST(request({ handle: "taken" }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "handle_already_claimed" });
  });

  it("maps invalid domain handles to bad request responses", async () => {
    vi.mocked(claimUserHandle).mockRejectedValueOnce(new InvalidHandleError());

    const res = await POST(request({ handle: "valid_shape" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_handle" });
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/account/handle", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
