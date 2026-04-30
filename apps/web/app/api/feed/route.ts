import { NextResponse } from "next/server";
import { getLatestFeed } from "@agent-social/db";

export async function GET() {
  try {
    const feed = await getLatestFeed();
    return NextResponse.json(feed);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}