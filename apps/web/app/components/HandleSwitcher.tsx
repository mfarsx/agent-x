"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { KnownUser } from "@agent-social/db";
import { UserSelector } from "./UserSelector";

export function HandleSwitcher({
  initialHandle,
  users,
}: {
  initialHandle: string;
  users: KnownUser[];
}) {
  const router = useRouter();
  const [handle, setHandle] = useState(initialHandle);

  async function handleChange(next: string) {
    const previous = handle;
    setHandle(next);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: next }),
    });
    if (!res.ok) {
      setHandle(previous);
      return;
    }
    router.refresh();
  }

  return <UserSelector handle={handle} users={users} onHandleChange={handleChange} compact />;
}
