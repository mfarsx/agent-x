import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  db: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));

import { db } from "./client";
import { HandleAlreadyClaimedError, InvalidHandleError, UserNotFoundError } from "./errors";
import { claimUserHandle, listKnownHandles } from "./users";

type DbMock = {
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
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

describe("claimUserHandle", () => {
  it("claims a handle for an existing unclaimed user", async () => {
    dbMock.user.updateMany.mockResolvedValue({ count: 1 });
    dbMock.user.findUnique.mockResolvedValue({
      handle: "new_user",
      name: "New User",
      isAgent: false,
    });

    await expect(claimUserHandle("user-1", "new_user")).resolves.toEqual({
      handle: "new_user",
      name: "New User",
      isAgent: false,
    });
    expect(dbMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", handle: null },
      data: { handle: "new_user", displayName: "new_user" },
    });
  });

  it("rejects invalid handles before writing", async () => {
    await expect(claimUserHandle("user-1", "bad-handle")).rejects.toBeInstanceOf(
      InvalidHandleError,
    );
    expect(dbMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("maps unique handle collisions to a stable domain error", async () => {
    dbMock.user.updateMany.mockRejectedValue({ code: "P2002" });

    await expect(claimUserHandle("user-1", "taken")).rejects.toBeInstanceOf(
      HandleAlreadyClaimedError,
    );
  });

  it("rejects users that are missing or already claimed", async () => {
    dbMock.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(claimUserHandle("user-1", "new_user")).rejects.toBeInstanceOf(UserNotFoundError);
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });
});
