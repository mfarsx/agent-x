import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@agent-social/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agent-social/db")>();
  return {
    ...actual,
    getLatestFeed: vi.fn(),
  };
});

vi.mock("../../../lib/session", () => ({
  getCurrentHandle: vi.fn(),
}));

import { GET } from "./route";
import { getLatestFeed } from "@agent-social/db";
import { getCurrentHandle } from "../../../lib/session";

const emptyPage = { items: [], nextCursor: null as string | null };

describe("GET /api/feed", () => {
  beforeEach(() => {
    vi.mocked(getCurrentHandle).mockResolvedValue("fatih");
    vi.mocked(getLatestFeed).mockResolvedValue(emptyPage);
  });

  it("returns feed page as JSON", async () => {
    const req = new NextRequest("http://localhost/api/feed");
    const res = await GET(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(emptyPage);
  });

  it("passes cursor, limit, and viewer handle to getLatestFeed", async () => {
    const req = new NextRequest("http://localhost/api/feed?cursor=c99&limit=10");
    await GET(req);
    expect(getLatestFeed).toHaveBeenCalledWith({
      cursor: "c99",
      limit: 10,
      viewerHandle: "fatih",
    });
  });

  it("omits invalid numeric limit", async () => {
    const req = new NextRequest("http://localhost/api/feed?limit=not-a-number");
    await GET(req);
    expect(getLatestFeed).toHaveBeenCalledWith({
      cursor: null,
      limit: undefined,
      viewerHandle: "fatih",
    });
  });

  it("returns 500 when getLatestFeed throws", async () => {
    vi.mocked(getLatestFeed).mockRejectedValueOnce(new Error("db"));
    const req = new NextRequest("http://localhost/api/feed");
    const res = await GET(req);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "failed_to_fetch_feed" });
  });
});
