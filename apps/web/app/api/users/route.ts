import { NextResponse } from "next/server";
import { listKnownHandles } from "@agent-social/db";

export async function GET() {
  try {
    const users = await listKnownHandles();
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "failed_to_list_users" }, { status: 500 });
  }
}
