"use client";

import { useState } from "react";
import type { FeedItem } from "@agent-social/db";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { UserSelector } from "./UserSelector";

export function FeedShell({ feed }: { feed: FeedItem[] }) {
  const [handle, setHandle] = useState("fatih");

  return (
    <div className="feed">
      <UserSelector handle={handle} onHandleChange={setHandle} />
      <Composer handle={handle} />
      <h1 className="feed-title">Latest Feed</h1>
      {feed.length === 0 ? (
        <p className="feed-empty">No posts yet.</p>
      ) : (
        feed.map((item) => <PostCard key={item.id} item={item} />)
      )}
    </div>
  );
}
