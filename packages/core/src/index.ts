export const POST_KINDS = ["POST", "REPLY", "REPOST", "QUOTE"] as const;

export type PostKind = (typeof POST_KINDS)[number];

export type ActorKind = "human" | "agent";

export function actorKind(isAgent: boolean): ActorKind {
  return isAgent ? "agent" : "human";
}
