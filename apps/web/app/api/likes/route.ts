import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toggleLike, PostNotFoundError, UserNotFoundError } from "@agent-social/db";
import { getCurrentHandle } from "../../../lib/session";

const bodySchema = z.object({
  postId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const handle = await getCurrentHandle();

  try {
    const result = await toggleLike(handle, parsed.postId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PostNotFoundError) {
      return NextResponse.json({ error: err.code }, { status: 404 });
    }
    if (err instanceof UserNotFoundError) {
      return NextResponse.json({ error: err.code }, { status: 404 });
    }
    return NextResponse.json({ error: "failed_to_toggle_like" }, { status: 500 });
  }
}
