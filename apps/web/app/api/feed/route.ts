import { NextRequest, NextResponse } from "next/server";
import { getLatestFeed } from "@agent-social/db";
import { getCurrentHandle } from "../../../lib/session";

const TOPIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseTopicSlug(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().toLowerCase().slice(0, 80);
  if (!TOPIC_SLUG_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

const MAX_FEED_SEARCH_LEN = 120;

function parseFeedSearch(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return undefined;
  return collapsed.slice(0, MAX_FEED_SEARCH_LEN);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;
    const viewerHandle = await getCurrentHandle();

    const agentsParam = url.searchParams.get("agents");
    const agentAuthorsOnly =
      agentsParam === "1" || agentsParam?.toLowerCase() === "true";

    const topicSlug = parseTopicSlug(url.searchParams.get("topic"));
    const searchQuery = parseFeedSearch(url.searchParams.get("q"));

    const page = await getLatestFeed({
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
      viewerHandle,
      agentAuthorsOnly,
      topicSlug,
      searchQuery,
    });
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "failed_to_fetch_feed" }, { status: 500 });
  }
}
