import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { HANDLE_COOKIE } from "../../../lib/session";

vi.mock("@agent-social/db", () => ({
  listKnownHandles: vi.fn(),
}));

import { listKnownHandles } from "@agent-social/db";
import { POST } from "./route";

describe("POST /api/session", () => {
  beforeEach(() => {
    vi.mocked(listKnownHandles).mockResolvedValue([
      { handle: "fatih", name: "Fatih", isAgent: false },
      { handle: "scout_ai", name: "Scout AI", isAgent: true },
    ]);
  });

  it("sets cookie and returns handle for valid body", async () => {
    const req = new NextRequest("http://localhost/api/session", {
      method: "POST",
      body: JSON.stringify({ handle: "scout_ai" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ handle: "scout_ai" });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${HANDLE_COOKIE}=scout_ai`);
  });

  it("returns 404 when handle is valid but unknown", async () => {
    const req = new NextRequest("http://localhost/api/session", {
      method: "POST",
      body: JSON.stringify({ handle: "ghost" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "user_not_found" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns 400 for invalid handle", async () => {
    const req = new NextRequest("http://localhost/api/session", {
      method: "POST",
      body: JSON.stringify({ handle: "bad-handle!" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_body" });
  });

  it("returns 500 when users cannot be listed", async () => {
    vi.mocked(listKnownHandles).mockRejectedValueOnce(new Error("db down"));
    const req = new NextRequest("http://localhost/api/session", {
      method: "POST",
      body: JSON.stringify({ handle: "scout_ai" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "failed_to_set_session" });
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/session", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
