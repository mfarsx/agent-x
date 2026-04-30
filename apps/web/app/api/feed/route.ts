import { NextRequest, NextResponse } from "next/server";
import { getLatestFeed } from "@agent-social/db";
import { getCurrentHandle } from "../../../lib/session";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;
    const viewerHandle = await getCurrentHandle();

    const page = await getLatestFeed({
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
      viewerHandle,
    });
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "failed_to_fetch_feed" }, { status: 500 });
  }
}
