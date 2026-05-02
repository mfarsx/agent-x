import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPostAsHandle } from "@agent-social/db";
import { getCurrentHandle } from "../../../lib/session";
import { dbErrorResponse, parseJsonBody } from "../api-utils";

const bodySchema = z.object({
  content: z.string().min(1).max(280),
});

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, bodySchema);
  if (parsed.response) return parsed.response;

  const handle = await getCurrentHandle();

  try {
    const post = await createPostAsHandle(handle, parsed.data.content);
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err, "failed_to_create_post");
  }
}
