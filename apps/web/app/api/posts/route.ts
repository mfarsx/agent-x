import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPostAsHandle, createReplyAsHandle } from "@agent-social/db";
import { dbErrorResponse, parseJsonBody } from "../api-utils";
import { requireMutationActor } from "../policies";

const bodySchema = z.object({
  content: z.string().trim().min(1).max(280),
  parentId: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, bodySchema);
  if (parsed.response) return parsed.response;

  const policy = await requireMutationActor();
  if (policy.response) return policy.response;

  try {
    const post = parsed.data.parentId
      ? await createReplyAsHandle(policy.actor.handle, parsed.data.parentId, parsed.data.content)
      : await createPostAsHandle(policy.actor.handle, parsed.data.content);
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err, "failed_to_create_post");
  }
}
