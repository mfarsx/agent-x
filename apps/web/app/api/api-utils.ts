import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { InvalidContentError, PostNotFoundError, UserNotFoundError } from "@agent-social/db";

export const postIdBodySchema = z.object({
  postId: z.string().min(1),
});

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function parseJsonBody<T>(request: NextRequest, schema: z.ZodType<T>) {
  try {
    return { data: schema.parse(await request.json()), response: null };
  } catch {
    return { data: null, response: jsonError("invalid_body", 400) };
  }
}

export function dbErrorResponse(err: unknown, fallbackCode: string) {
  if (err instanceof InvalidContentError) {
    return jsonError(err.code, 400);
  }
  if (err instanceof PostNotFoundError || err instanceof UserNotFoundError) {
    return jsonError(err.code, 404);
  }
  return jsonError(fallbackCode, 500);
}
