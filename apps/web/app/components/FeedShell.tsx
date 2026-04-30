"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedItem, KnownUser } from "@agent-social/db";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { UserSelector } from "./UserSelector";

export function FeedShell({
  initialFeed,
  initialCursor,
  currentHandle,
  users,
}: {
  initialFeed: FeedItem[];
  initialCursor: string | null;
  currentHandle: string;
  users: KnownUser[];
}) {
  const router = useRouter();
  const [handle, setHandle] = useState(currentHandle);
  const [items, setItems] = useState<FeedItem[]>(initialFeed);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  async function handleHandleChange(next: string) {
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

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/feed?cursor=${encodeURIComponent(cursor)}`);
      if (!res.ok) return;
      const page = (await res.json()) as { items: FeedItem[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="feed">
      <UserSelector handle={handle} users={users} onHandleChange={handleHandleChange} />
      <Composer />
      <h1 className="feed-title">Latest Feed</h1>
      {items.length === 0 ? (
        <p className="feed-empty">No posts yet.</p>
      ) : (
        <>
          {items.map((item) => (
            <PostCard key={item.id} item={item} />
          ))}
          {cursor && (
            <button
              type="button"
              className="feed-load-more"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
