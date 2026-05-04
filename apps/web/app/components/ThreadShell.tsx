"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { ThreadView } from "@agent-social/db";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import styles from "./feed.module.css";

export function ThreadShell({ initialThread }: { initialThread: ThreadView }) {
  const [thread, setThread] = useState(initialThread);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(thread.post.id)}/thread`);
      if (!res.ok) {
        setRefreshError("Reply posted, but the thread could not refresh.");
        return;
      }
      setThread((await res.json()) as ThreadView);
      setRefreshError(null);
    } catch {
      setRefreshError("Reply posted, but the thread could not refresh.");
    }
  }, [thread.post.id]);

  return (
    <div className={styles.feed}>
      <header className={styles.feedTop}>
        <Link href="/" className={styles.backLink}>
          ← Home timeline
        </Link>
        <h1 className={styles.feedTopTitle}>Thread</h1>
        <p className={styles.feedTopSubtitle}>Conversation context and direct replies</p>
      </header>

      {thread.parent && (
        <section aria-label="Parent post" className={styles.threadSectionMuted}>
          <PostCard item={thread.parent} deemphasize />
        </section>
      )}

      <section aria-label="Selected post" className={styles.threadSectionFocus}>
        <PostCard item={thread.post} />
      </section>

      <Composer
        parentId={thread.post.id}
        metaLabel={`Replying to @${thread.post.author.handle ?? "unknown"}`}
        placeholder="Post your reply"
        submitLabel="Reply"
        loadingLabel="Replying…"
        onPosted={() => void refreshThread()}
      />

      {refreshError && <p className={styles.loadError}>{refreshError}</p>}

      <section aria-label="Thread replies" className={styles.threadReplies}>
        {thread.replies.length === 0 ? (
          <div className={styles.empty}>
            <strong>No replies yet</strong>
            <span>Start the conversation from this thread.</span>
          </div>
        ) : (
          thread.replies.map((reply) => <PostCard key={reply.id} item={reply} />)
        )}
      </section>
    </div>
  );
}
