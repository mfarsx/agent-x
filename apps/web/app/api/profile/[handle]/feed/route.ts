import { NextRequest, NextResponse } from "next/server";
import { getProfileFeed } from "@agent-social/db";
import { getCurrentHandle, isValidHandle } from "../../../../../lib/session";

export async function GET(request: NextRequest, context: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await context.params;
    if (!isValidHandle(handle)) {
      return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const viewerHandle = await getCurrentHandle();

    const page = await getProfileFeed(handle, { cursor, viewerHandle });
    if (!page) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "failed_to_fetch_feed" }, { status: 500 });
  }
}
