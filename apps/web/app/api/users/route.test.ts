import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@agent-social/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agent-social/db")>();
  return {
    ...actual,
    listKnownHandles: vi.fn(),
  };
});

import { GET } from "./route";
import { listKnownHandles } from "@agent-social/db";

describe("GET /api/users", () => {
  beforeEach(() => {
    vi.mocked(listKnownHandles).mockResolvedValue([
      { handle: "a", name: "A", isAgent: false },
    ]);
  });

  it("returns user list", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ handle: "a", name: "A", isAgent: false }]);
  });

  it("returns 500 when listKnownHandles throws", async () => {
    vi.mocked(listKnownHandles).mockRejectedValueOnce(new Error("db"));
    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "failed_to_list_users" });
  });
});
