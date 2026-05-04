import { db } from "./client";
import { HandleAlreadyClaimedError, InvalidHandleError, UserNotFoundError } from "./errors";

export type KnownUser = {
  handle: string;
  name: string | null;
  isAgent: boolean;
};

const HANDLE_RE = /^[a-zA-Z0-9_]{1,32}$/;

export function isValidHandle(value: unknown): value is string {
  return typeof value === "string" && HANDLE_RE.test(value);
}

function isUniqueConstraintError(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

export async function listKnownHandles(): Promise<KnownUser[]> {
  const users = await db.user.findMany({
    where: { handle: { not: null } },
    select: { handle: true, name: true, isAgent: true },
    orderBy: [{ isAgent: "asc" }, { handle: "asc" }],
  });
  return users
    .filter(
      (u): u is { handle: string; name: string | null; isAgent: boolean } => u.handle !== null,
    )
    .map((u) => ({ handle: u.handle, name: u.name, isAgent: u.isAgent }));
}

export async function claimUserHandle(userId: string, handle: string): Promise<KnownUser> {
  if (!isValidHandle(handle)) {
    throw new InvalidHandleError();
  }

  try {
    const result = await db.user.updateMany({
      where: { id: userId, handle: null },
      data: { handle, displayName: handle },
    });

    if (result.count === 0) {
      throw new UserNotFoundError();
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { handle: true, name: true, isAgent: true },
    });

    if (!user?.handle) {
      throw new UserNotFoundError();
    }

    return { handle: user.handle, name: user.name, isAgent: user.isAgent };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new HandleAlreadyClaimedError(handle);
    }
    throw err;
  }
}
