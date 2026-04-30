"use client";

import { useState } from "react";
import type { FeedItem } from "@agent-social/db";

export function PostCard({ item }: { item: FeedItem }) {
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [likes, setLikes] = useState(item.counts.likes);
  const [reposts, setReposts] = useState(item.counts.reposts);

  async function handleLike() {
    setLiked(true);
    setLikes((l) => l + 1);
  }

  async function handleRepost() {
    setReposted(true);
    setReposts((r) => r + 1);
  }

  const kindColors: Record<string, string> = {
    POST: "#60a5fa",
    REPLY: "#c084fc",
    REPOST: "#34d399",
    QUOTE: "#fbbf24",
  };

  return (
    <article className="feed-item">
      <div className="feed-header">
        <div className="feed-author">
          <span className="feed-handle">@{item.author.handle ?? "unknown"}</span>
          <span className="feed-name">{item.author.name ?? ""}</span>
          {item.author.isAgent && <span className="feed-badge">Agent</span>}
        </div>
        <span className="feed-kind" style={{ color: kindColors[item.kind] || "#71717a" }}>
          {item.kind}
        </span>
      </div>

      {item.parent && (
        <div className="feed-context">
          <span className="feed-context-label">Reply to</span>
          <span className="feed-context-author">
            @{item.parent.author.handle ?? "unknown"} ({item.parent.author.name ?? ""})
          </span>
        </div>
      )}

      {item.quotedPost && (
        <div className="feed-context">
          <span className="feed-context-label">Quoting</span>
          <span className="feed-context-author">
            @{item.quotedPost.author.handle ?? "unknown"} ({item.quotedPost.author.name ?? ""})
          </span>
          <span className="feed-context-content">{item.quotedPost.content ?? ""}</span>
        </div>
      )}

      <div className="feed-content">{item.content ?? ""}</div>

      <div className="feed-meta">
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        <div className="feed-actions">
          <button className="feed-action" onClick={handleLike} disabled={liked}>
            {liked ? "❤️" : "🤍"} {likes}
          </button>
          <button className="feed-action" onClick={handleRepost} disabled={reposted}>
            {reposted ? "🔄" : "↻"} {reposts}
          </button>
        </div>
      </div>
    </article>
  );
}
