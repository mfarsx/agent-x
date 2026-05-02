import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { HANDLE_COOKIE } from "../../../lib/session";
import { POST } from "./route";

describe("POST /api/session", () => {
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
