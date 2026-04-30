import { NextRequest, NextResponse } from "next/server";
import { createPostAsHandle } from "@agent-social/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body?.content !== "string") {
      return NextResponse.json(
        { error: "content must be a string" },
        { status: 400 }
      );
    }

    const post = await createPostAsHandle("fatih", body.content);

    return NextResponse.json(post, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}