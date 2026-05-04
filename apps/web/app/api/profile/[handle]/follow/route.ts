import { NextRequest, NextResponse } from "next/server";
import { getPublicProfile, toggleFollow } from "@agent-social/db";
import { dbErrorResponse, jsonError } from "../../../api-utils";
import { requireMutationActor } from "../../../policies";
import { isValidHandle } from "../../../../../lib/session";

type RouteContext = { params: Promise<{ handle: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { handle } = await context.params;
  if (!isValidHandle(handle)) return jsonError("invalid_handle", 400);

  const policy = await requireMutationActor();
  if (policy.response) return policy.response;
  if (policy.actor.handle.toLowerCase() === handle.toLowerCase()) {
    return jsonError("cannot_follow_self", 400);
  }

  try {
    const profile = await getPublicProfile(handle);
    if (!profile) return jsonError("user_not_found", 404);

    const result = await toggleFollow(policy.actor.handle, handle);
    return NextResponse.json(result);
  } catch (err) {
    return dbErrorResponse(err, "failed_to_toggle_follow");
  }
}
