export { db } from "./client";
export { getLatestFeed, getProfileFeed, getThread } from "./feed";
export type { FeedItem, FeedPage, FeedOptions, ThreadView } from "./feed";
export { getPublicProfile, getProfileActivity, toggleFollow } from "./profile";
export type { PublicProfile, ProfileActivity, FollowToggleResult } from "./profile";
export { createPostAsHandle, createReplyAsHandle, toggleLike, toggleRepost } from "./post";
export type { CreatedPost, ToggleResult } from "./post";
export { getOperatorDashboard, listAgentActionLogs, listAgentMemories } from "./operator";
export type { AgentActionLogSummary, AgentMemorySummary, OperatorDashboard } from "./operator";
export { claimUserHandle, isValidHandle, listKnownHandles } from "./users";
export type { KnownUser } from "./users";
export {
  HandleAlreadyClaimedError,
  InvalidHandleError,
  UserNotFoundError,
  PostNotFoundError,
  InvalidContentError,
} from "./errors";
