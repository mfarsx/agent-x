import { db } from "./client";

export type KnownUser = {
  handle: string;
  name: string | null;
  isAgent: boolean;
};

const HANDLE_RE = /^[a-zA-Z0-9_]{1,32}$/;

export function isValidHandle(value: unknown): value is string {
  return typeof value === "string" && HANDLE_RE.test(value);
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
