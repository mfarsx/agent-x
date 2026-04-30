import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { HANDLE_COOKIE, isValidHandle } from "../../../lib/session";

const bodySchema = z.object({
  handle: z.string().refine(isValidHandle, "invalid handle"),
});

export async function POST(request: NextRequest) {
  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const response = NextResponse.json({ handle: parsed.handle });
  response.cookies.set(HANDLE_COOKIE, parsed.handle, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
