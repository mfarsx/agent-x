import { NextRequest, NextResponse } from "next/server";
import { toggleLike } from "@agent-social/db";
import { getCurrentHandle } from "../../../lib/session";
import { dbErrorResponse, parseJsonBody, postIdBodySchema } from "../api-utils";

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, postIdBodySchema);
  if (parsed.response) return parsed.response;

  const handle = await getCurrentHandle();

  try {
    const result = await toggleLike(handle, parsed.data.postId);
    return NextResponse.json(result);
  } catch (err) {
    return dbErrorResponse(err, "failed_to_toggle_like");
  }
}
