"use client";

import { useState } from "react";
import type { FeedItem } from "@agent-social/db";
import styles from "./feed.module.css";

type PostAction = "like" | "repost";

const KIND_COLORS: Record<string, string> = {
  POST: "#60a5fa",
  REPLY: "#c084fc",
  REPOST: "#34d399",
  QUOTE: "#fbbf24",
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function initials(name: string | null, handle: string | null): string {
  const source = name?.trim() || handle?.trim() || "?";
  return source.slice(0, 2).toUpperCase();
}

function labelForKind(kind: string): string {
  const labels: Record<string, string> = {
    POST: "Post",
    REPLY: "Reply",
    REPOST: "Repost",
    QUOTE: "Quote",
  };
  return labels[kind] ?? kind;
}

function actionClass(active: boolean, isPending: boolean): string {
  return [styles.action, active ? styles.actionActive : "", isPending ? styles.actionPending : ""]
    .filter(Boolean)
    .join(" ");
}

export function PostCard({ item, deemphasize = false }: { item: FeedItem; deemphasize?: boolean }) {
  const [liked, setLiked] = useState(item.viewer.liked);
  const [reposted, setReposted] = useState(item.viewer.reposted);
  const [likes, setLikes] = useState(item.counts.likes);
  const [reposts, setReposts] = useState(item.counts.reposts);
  const [pending, setPending] = useState<PostAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function toggle(kind: PostAction) {
    if (pending) return;
    setPending(kind);
    setActionError(null);
    const path = kind === "like" ? "/api/likes" : "/api/reposts";
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: item.id }),
      });
      if (!res.ok) {
        setActionError("Action failed. Please try again.");
        return;
      }
      const data = (await res.json()) as { active: boolean; count: number };
      if (kind === "like") {
        setLiked(data.active);
        setLikes(data.count);
      } else {
        setReposted(data.active);
        setReposts(data.count);
      }
    } catch {
      setActionError("Action failed. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <article className={`${styles.item}${deemphasize ? ` ${styles.itemMuted}` : ""}`}>
      <div
        className={item.author.isAgent ? `${styles.avatar} ${styles.avatarAgent}` : styles.avatar}
      >
        {item.author.image ? (
          <img src={item.author.image} alt="" />
        ) : (
          initials(item.author.name, item.author.handle)
        )}
      </div>
      <div className={styles.itemBody}>
        <div className={styles.header}>
          <div className={styles.author}>
            <span className={styles.name}>
              {item.author.name ?? item.author.handle ?? "Unknown"}
            </span>
            <span className={styles.handle}>@{item.author.handle ?? "unknown"}</span>
            <span className={styles.dot}>·</span>
            <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>
              {formatRelativeTime(item.createdAt)}
            </time>
            {item.author.isAgent && <span className={styles.badge}>Agent</span>}
          </div>
          <span className={styles.kind} style={{ color: KIND_COLORS[item.kind] || "#71717a" }}>
            {labelForKind(item.kind)}
          </span>
        </div>

        {item.parent && (
          <div className={styles.context}>
            <span className={styles.contextLabel}>Replying to</span>
            <span className={styles.contextAuthor}>
              @{item.parent.author.handle ?? "unknown"} ({item.parent.author.name ?? ""})
            </span>
          </div>
        )}

        {item.quotedPost && (
          <div className={styles.context}>
            <span className={styles.contextLabel}>Quoted signal</span>
            <span className={styles.contextAuthor}>
              @{item.quotedPost.author.handle ?? "unknown"} ({item.quotedPost.author.name ?? ""})
            </span>
            <span className={styles.contextContent}>{item.quotedPost.content ?? ""}</span>
          </div>
        )}

        <div className={styles.content}>{item.content ?? ""}</div>

        <div className={styles.meta}>
          <div className={styles.actions}>
            <button
              className={actionClass(liked, pending === "like")}
              onClick={() => toggle("like")}
              disabled={pending === "like"}
              aria-pressed={liked}
              aria-label={liked ? "Unlike post" : "Like post"}
            >
              {liked ? "❤️" : "🤍"} {likes}
            </button>
            <button
              className={actionClass(reposted, pending === "repost")}
              onClick={() => toggle("repost")}
              disabled={pending === "repost"}
              aria-pressed={reposted}
              aria-label={reposted ? "Undo repost" : "Repost"}
            >
              {reposted ? "🔄" : "↻"} {reposts}
            </button>
          </div>
          {actionError && <p className={styles.actionError}>{actionError}</p>}
        </div>
      </div>
    </article>
  );
}
