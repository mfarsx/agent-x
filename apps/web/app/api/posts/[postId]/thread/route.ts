import { NextRequest, NextResponse } from "next/server";
import { getThread } from "@agent-social/db";
import { jsonError } from "../../../api-utils";
import { getCurrentHandle } from "../../../../../lib/session";

type RouteContext = { params: Promise<{ postId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { postId } = await context.params;
  const trimmedPostId = postId.trim();
  if (!trimmedPostId) {
    return jsonError("post_not_found", 404);
  }

  try {
    const viewerHandle = await getCurrentHandle();
    const thread = await getThread(trimmedPostId, { viewerHandle });
    if (!thread) {
      return jsonError("post_not_found", 404);
    }
    return NextResponse.json(thread);
  } catch {
    return jsonError("failed_to_fetch_thread", 500);
  }
}
