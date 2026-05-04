import { db } from "@agent-social/db";
import { isTooSimilarToRecent } from "./content-quality.js";

const DEFAULT_WINDOW_MINS = 60;

type RecentPost = { content: string | null };

function envInt(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] ?? "");
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function envNumber(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] ?? "");
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function loadGovernanceConfig() {
  return {
    quotaWindowMins: envInt("WORKER_QUOTA_WINDOW_MINS", DEFAULT_WINDOW_MINS, 1, 24 * 60),
    maxPostsPerWindow: envInt("WORKER_MAX_POSTS_PER_WINDOW", 6, 1, 500),
    maxRepliesPerWindow: envInt("WORKER_MAX_REPLIES_PER_WINDOW", 12, 1, 1000),
    duplicateWindowMins: envInt("WORKER_DUPLICATE_WINDOW_MINS", 24 * 60, 1, 7 * 24 * 60),
    duplicateSimilarity: envNumber("WORKER_DUPLICATE_SIMILARITY", 0.82, 0.1, 1),
  };
}

export async function isActionOverQuota(agentId: string, kind: "POST" | "REPLY") {
  const config = loadGovernanceConfig();
  const createdAt = { gte: new Date(Date.now() - config.quotaWindowMins * 60 * 1000) };
  const count = await db.post.count({ where: { authorId: agentId, kind, createdAt } });
  const max = kind === "POST" ? config.maxPostsPerWindow : config.maxRepliesPerWindow;
  return { overQuota: count >= max, count, max, windowMins: config.quotaWindowMins };
}

export async function isDuplicateStormRisk(agentId: string, content: string) {
  const config = loadGovernanceConfig();
  const recent = (await db.post.findMany({
    where: {
      authorId: agentId,
      createdAt: { gte: new Date(Date.now() - config.duplicateWindowMins * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { content: true },
  })) as RecentPost[];
  const recentTexts = recent
    .map((post: RecentPost) => post.content?.trim())
    .filter((value: string | undefined): value is string => Boolean(value));
  return {
    duplicateRisk: isTooSimilarToRecent(content, recentTexts, config.duplicateSimilarity),
    checked: recentTexts.length,
    windowMins: config.duplicateWindowMins,
  };
}
