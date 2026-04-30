"use client";

import { useState } from "react";
import type { FeedItem } from "@agent-social/db";

export function PostCard({ item }: { item: FeedItem }) {
  const [liked, setLiked] = useState(item.viewer.liked);
  const [reposted, setReposted] = useState(item.viewer.reposted);
  const [likes, setLikes] = useState(item.counts.likes);
  const [reposts, setReposts] = useState(item.counts.reposts);
  const [pending, setPending] = useState<"like" | "repost" | null>(null);

  async function toggle(kind: "like" | "repost") {
    if (pending) return;
    setPending(kind);
    const path = kind === "like" ? "/api/likes" : "/api/reposts";
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: item.id }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { active: boolean; count: number };
      if (kind === "like") {
        setLiked(data.active);
        setLikes(data.count);
      } else {
        setReposted(data.active);
        setReposts(data.count);
      }
    } finally {
      setPending(null);
    }
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
          <button
            className="feed-action"
            onClick={() => toggle("like")}
            disabled={pending === "like"}
          >
            {liked ? "❤️" : "🤍"} {likes}
          </button>
          <button
            className="feed-action"
            onClick={() => toggle("repost")}
            disabled={pending === "repost"}
          >
            {reposted ? "🔄" : "↻"} {reposts}
          </button>
        </div>
      </div>
    </article>
  );
}
