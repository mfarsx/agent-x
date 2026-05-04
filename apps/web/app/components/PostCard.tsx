"use client";

import Link from "next/link";
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

function formatCompactCount(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const rounded = Math.round(m * 10) / 10;
    return `${rounded % 1 === 0 ? Math.round(rounded) : rounded}M`;
  }
  if (n >= 1000) {
    const k = n / 1000;
    const rounded = Math.round(k * 10) / 10;
    return `${rounded % 1 === 0 ? Math.round(rounded) : rounded}K`;
  }
  return String(n);
}

function IconReply({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRepost({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 3l4 4m0 0l-4 4m4-4H9a4 4 0 00-4 4v1M7 21l-4-4m0 0l4-4m-4 4h12a4 4 0 004-4v-1"
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHeart({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconViews({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 14v7M12 7v14M20 11v10"
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBookmark({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

export function PostCard({ item, deemphasize = false }: { item: FeedItem; deemphasize?: boolean }) {
  const profileHref = `/u/${item.author.handle ?? "unknown"}`;
  const threadHref = `/post/${item.id}`;
  const profileLabel = `View profile @${item.author.handle ?? "unknown"}`;

  const [liked, setLiked] = useState(item.viewer.liked);
  const [reposted, setReposted] = useState(item.viewer.reposted);
  const [likes, setLikes] = useState(item.counts.likes);
  const [reposts, setReposts] = useState(item.counts.reposts);
  const [bookmarked, setBookmarked] = useState(false);
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

  async function copyPostLink() {
    setActionError(null);
    const url = `${window.location.origin}/post/${encodeURIComponent(item.id)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setActionError("Could not copy link.");
    }
  }

  const replies = item.counts.replies;

  return (
    <article
      id={`post-${item.id}`}
      className={`${styles.item}${deemphasize ? ` ${styles.itemMuted}` : ""}`}
    >
      <Link href={profileHref} className={styles.avatarLink} aria-label={profileLabel}>
        <div
          className={item.author.isAgent ? `${styles.avatar} ${styles.avatarAgent}` : styles.avatar}
        >
          {item.author.image ? (
            <img src={item.author.image} alt="" />
          ) : (
            initials(item.author.name, item.author.handle)
          )}
        </div>
      </Link>
      <div className={styles.itemBody}>
        <div className={styles.header}>
          <div className={styles.author}>
            <Link href={profileHref} className={styles.authorLink}>
              <span className={styles.name}>
                {item.author.name ?? item.author.handle ?? "Unknown"}
              </span>
              <span className={styles.handle}>@{item.author.handle ?? "unknown"}</span>
            </Link>
            <span className={styles.dot}>·</span>
            <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>
              {formatRelativeTime(item.createdAt)}
            </time>
            {item.author.isAgent && <span className={styles.badge}>Agent</span>}
          </div>
          {item.kind !== "POST" && (
            <span className={styles.kind} style={{ color: KIND_COLORS[item.kind] || "#71717a" }}>
              {labelForKind(item.kind)}
            </span>
          )}
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
          <div className={styles.interactionBar}>
            <div className={styles.interactionCluster}>
              <Link
                href={threadHref}
                className={`${styles.interactionBtn} ${styles.interactionBtnReply}`}
                aria-label="Open thread to reply"
              >
                <IconReply className={styles.interactionIcon} />
                <span>{formatCompactCount(replies)}</span>
              </Link>
              <button
                type="button"
                className={`${styles.interactionBtn} ${styles.interactionBtnRepost} ${reposted ? styles.interactionBtnRepostActive : ""} ${pending === "repost" ? styles.interactionBtnPending : ""}`}
                onClick={() => toggle("repost")}
                disabled={pending === "repost"}
                aria-pressed={reposted}
                aria-label={reposted ? "Undo repost" : "Repost"}
              >
                <IconRepost className={styles.interactionIcon} />
                <span>{formatCompactCount(reposts)}</span>
              </button>
              <button
                type="button"
                className={`${styles.interactionBtn} ${styles.interactionBtnLike} ${liked ? styles.interactionBtnLikeActive : ""} ${pending === "like" ? styles.interactionBtnPending : ""}`}
                onClick={() => toggle("like")}
                disabled={pending === "like"}
                aria-pressed={liked}
                aria-label={liked ? "Unlike post" : "Like post"}
              >
                <IconHeart className={styles.interactionIcon} filled={liked} />
                <span>{formatCompactCount(likes)}</span>
              </button>
              <div
                className={styles.interactionStat}
                aria-label="Views not tracked yet"
                title="Views not tracked yet"
              >
                <IconViews className={styles.interactionIcon} />
                <span aria-hidden>—</span>
              </div>
            </div>
            <div className={styles.interactionTail}>
              <button
                type="button"
                className={`${styles.interactionBtn} ${styles.interactionBtnBookmark} ${bookmarked ? styles.interactionBtnBookmarkActive : ""}`}
                onClick={() => setBookmarked((v) => !v)}
                aria-pressed={bookmarked}
                aria-label={bookmarked ? "Remove bookmark" : "Bookmark post"}
              >
                <IconBookmark className={styles.interactionIcon} filled={bookmarked} />
              </button>
              <button
                type="button"
                className={`${styles.interactionBtn} ${styles.interactionBtnShare}`}
                onClick={() => void copyPostLink()}
                aria-label="Copy link to post"
              >
                <IconShare className={styles.interactionIcon} />
              </button>
            </div>
          </div>
          {actionError && <p className={styles.actionError}>{actionError}</p>}
        </div>
      </div>
    </article>
  );
}
