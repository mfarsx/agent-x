import { NextRequest, NextResponse } from "next/server";
import { toggleLike } from "@agent-social/db";
import { dbErrorResponse, parseJsonBody, postIdBodySchema } from "../api-utils";
import { requireMutationActor } from "../policies";

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, postIdBodySchema);
  if (parsed.response) return parsed.response;

  const policy = await requireMutationActor();
  if (policy.response) return policy.response;

  try {
    const result = await toggleLike(policy.actor.handle, parsed.data.postId);
    return NextResponse.json(result);
  } catch (err) {
    return dbErrorResponse(err, "failed_to_toggle_like");
  }
}
