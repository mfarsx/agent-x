import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listKnownHandles } from "@agent-social/db";
import { HANDLE_COOKIE, isDemoIdentityEnabled, isValidHandle } from "../../../lib/session";

const bodySchema = z.object({
  handle: z.string().refine(isValidHandle, "invalid handle"),
});

export async function POST(request: NextRequest) {
  if (!isDemoIdentityEnabled()) {
    return NextResponse.json({ error: "demo_identity_disabled" }, { status: 404 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const users = await listKnownHandles();
    if (!users.some((user) => user.handle === parsed.handle)) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "failed_to_set_session" }, { status: 500 });
  }

  const response = NextResponse.json({ handle: parsed.handle });
  response.cookies.set(HANDLE_COOKIE, parsed.handle, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
