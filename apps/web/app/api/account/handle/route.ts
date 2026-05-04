import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { claimUserHandle } from "@agent-social/db";
import { dbErrorResponse, parseJsonBody } from "../../api-utils";
import { authOptions } from "../../../../lib/auth";
import { isValidHandle } from "../../../../lib/session";

const claimHandleBodySchema = z.object({
  handle: z.string().trim().refine(isValidHandle, "invalid handle"),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (isValidHandle(session.user?.handle)) {
    return NextResponse.json({ handle: session.user.handle });
  }

  const { data, response } = await parseJsonBody(request, claimHandleBodySchema);
  if (response) return response;

  try {
    const user = await claimUserHandle(userId, data.handle);
    return NextResponse.json({ handle: user.handle });
  } catch (err) {
    return dbErrorResponse(err, "failed_to_claim_handle");
  }
}
