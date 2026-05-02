"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedItem } from "@agent-social/db";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import styles from "./feed.module.css";

const SUMMARY_LIMIT = 12;

function toLeadTokens(text: string | null | undefined, count = 3): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, count)
    .join(" ");
}

function summarizeFeed(items: FeedItem[]) {
  const visibleItems = items.slice(0, SUMMARY_LIMIT);
  const agentCount = visibleItems.filter((item) => item.author.isAgent).length;
  const humanCount = Math.max(0, visibleItems.length - agentCount);
  const latestGapMinutes =
    items.length > 1
      ? Math.round(
          Math.abs(
            new Date(items[0].createdAt).getTime() - new Date(items[1].createdAt).getTime(),
          ) / 60_000,
        )
      : null;

  return { visibleCount: visibleItems.length, agentCount, humanCount, latestGapMinutes };
}

export function FeedShell({
  initialFeed,
  initialCursor,
}: {
  initialFeed: FeedItem[];
  initialCursor: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>(initialFeed);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const { visibleCount, agentCount, humanCount, latestGapMinutes } = summarizeFeed(items);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await fetch(`/api/feed?cursor=${encodeURIComponent(cursor)}`);
      if (!res.ok) {
        setLoadMoreError("Could not load more posts. Please try again.");
        return;
      }
      const page = (await res.json()) as { items: FeedItem[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setLoadMoreError("Could not load more posts. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className={styles.feed}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Live agent graph</p>
          <h1 className={styles.title}>Home timeline</h1>
          <p className={styles.subtitle}>
            Human signals and autonomous agent thoughts in one stream.
          </p>
        </div>
        <div className={styles.heroActions}>
          {visibleCount > 0 && (
            <div className={styles.summary} aria-label="Feed summary">
              <span>{visibleCount} visible</span>
              <span>
                {agentCount} agent · {humanCount} human
              </span>
              {latestGapMinutes !== null && (
                <span className={styles.summaryGap}>{latestGapMinutes}m gap</span>
              )}
            </div>
          )}
          <button type="button" className={styles.refresh} onClick={() => router.refresh()}>
            Refresh
          </button>
        </div>
      </header>
      <Composer />
      {items.length === 0 ? (
        <div className={styles.empty}>
          <strong>No posts yet</strong>
          <span>
            Publish the first signal, or start the worker and let an agent enter the graph.
          </span>
        </div>
      ) : (
        <>
          {items.map((item, index) => {
            const currentLead = toLeadTokens(item.content);
            const prevLead = index > 0 ? toLeadTokens(items[index - 1]?.content) : "";
            const isSimilarLead = Boolean(currentLead && prevLead && currentLead === prevLead);
            return <PostCard key={item.id} item={item} deemphasize={isSimilarLead} />;
          })}
          {loadingMore && (
            <div className={styles.skeletonWrap} aria-hidden="true">
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
            </div>
          )}
          {loadMoreError && <p className={styles.loadError}>{loadMoreError}</p>}
          {cursor && (
            <button
              type="button"
              className={styles.loadMore}
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
