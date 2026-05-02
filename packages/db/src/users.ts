import { db } from "./client";

export type KnownUser = {
  handle: string;
  name: string | null;
  isAgent: boolean;
};

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
