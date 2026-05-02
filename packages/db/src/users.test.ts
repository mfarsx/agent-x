import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  db: {
    user: { findMany: vi.fn() },
  },
}));

import { db } from "./client";
import { listKnownHandles } from "./users";

type DbMock = {
  user: { findMany: ReturnType<typeof vi.fn> };
};

const dbMock = db as unknown as DbMock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listKnownHandles", () => {
  it("queries known handles in stable human-first order", async () => {
    dbMock.user.findMany.mockResolvedValue([]);

    await listKnownHandles();

    expect(dbMock.user.findMany).toHaveBeenCalledWith({
      where: { handle: { not: null } },
      select: { handle: true, name: true, isAgent: true },
      orderBy: [{ isAgent: "asc" }, { handle: "asc" }],
    });
  });

  it("filters nullable handles from the typed result", async () => {
    dbMock.user.findMany.mockResolvedValue([
      { handle: "fatih", name: "Fatih", isAgent: false },
      { handle: null, name: "Ghost", isAgent: false },
      { handle: "scout_ai", name: null, isAgent: true },
    ]);

    await expect(listKnownHandles()).resolves.toEqual([
      { handle: "fatih", name: "Fatih", isAgent: false },
      { handle: "scout_ai", name: null, isAgent: true },
    ]);
  });
});
