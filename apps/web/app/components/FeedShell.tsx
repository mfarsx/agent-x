"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedItem } from "@agent-social/db";
import { FEED_REFETCH_EVENT } from "../../lib/feed-events";
import type { HomeFeedFilter } from "./feed-chrome-context";
import { useFeedChrome } from "./feed-chrome-context";
import { PostCard } from "./PostCard";
import styles from "./feed.module.css";

const SUMMARY_LIMIT = 12;
const FEED_POLL_MS = 20_000;

function appendHomeFeedSearchParams(
  params: URLSearchParams,
  filter: HomeFeedFilter,
  searchQuery: string,
): void {
  if (filter.kind === "agents_only") params.set("agents", "1");
  if (filter.kind === "topic") params.set("topic", filter.slug);
  const q = searchQuery.trim();
  if (q) params.set("q", q);
}

function homeFeedFetchUrl(
  filter: HomeFeedFilter,
  searchQuery: string,
  cursor?: string | null,
): string {
  const params = new URLSearchParams();
  appendHomeFeedSearchParams(params, filter, searchQuery);
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `/api/feed?${qs}` : "/api/feed";
}

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

function mergeNewFromFirstPage(previous: FeedItem[], firstPage: FeedItem[]): FeedItem[] {
  const prevIds = new Set(previous.map((i) => i.id));
  const fresh = firstPage.filter((i) => !prevIds.has(i.id));
  if (fresh.length === 0) return previous;
  return [...fresh, ...previous];
}

export function FeedShell({
  initialFeed,
  initialCursor,
}: {
  initialFeed: FeedItem[];
  initialCursor: string | null;
}) {
  const { homeFeedFilter, homeFeedSearch, setFeedChrome, clearFeedChrome } = useFeedChrome();

  const [items, setItems] = useState<FeedItem[]>(() =>
    homeFeedFilter.kind === "all" && !homeFeedSearch.trim() ? initialFeed : [],
  );
  const [cursor, setCursor] = useState<string | null>(() =>
    homeFeedFilter.kind === "all" && !homeFeedSearch.trim() ? initialCursor : null,
  );
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const skippedInitialAllFetch = useRef(false);

  const refetchFromApi = useCallback(async () => {
    try {
      const res = await fetch(homeFeedFetchUrl(homeFeedFilter, homeFeedSearch));
      if (!res.ok) return;
      const page = (await res.json()) as { items: FeedItem[]; nextCursor: string | null };
      if (!hasLoadedMore) {
        setItems(page.items);
        setCursor(page.nextCursor);
        return;
      }
      setItems((prev) => mergeNewFromFirstPage(prev, page.items));
    } catch {
      /* network hiccup; next poll or manual refresh can recover */
    }
  }, [hasLoadedMore, homeFeedFilter, homeFeedSearch]);

  useEffect(() => {
    setFeedChrome({
      summary: summarizeFeed(items),
      onRefresh: () => {
        void refetchFromApi();
      },
    });
  }, [items, refetchFromApi, setFeedChrome]);

  useEffect(() => {
    return () => clearFeedChrome();
  }, [clearFeedChrome]);

  useEffect(() => {
    if (homeFeedFilter.kind !== "all" || homeFeedSearch.trim()) return;
    setItems(initialFeed);
    setCursor(initialCursor);
    setHasLoadedMore(false);
  }, [initialFeed, initialCursor, homeFeedFilter.kind, homeFeedSearch]);

  useEffect(() => {
    if (
      !skippedInitialAllFetch.current &&
      homeFeedFilter.kind === "all" &&
      !homeFeedSearch.trim()
    ) {
      skippedInitialAllFetch.current = true;
      return;
    }
    skippedInitialAllFetch.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(homeFeedFetchUrl(homeFeedFilter, homeFeedSearch));
        if (!res.ok || cancelled) return;
        const page = (await res.json()) as { items: FeedItem[]; nextCursor: string | null };
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setHasLoadedMore(false);
        setLoadMoreError(null);
      } catch {
        if (!cancelled) setLoadMoreError("Could not load feed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [homeFeedFilter, homeFeedSearch]);

  useEffect(() => {
    const onRefetch = () => {
      void refetchFromApi();
    };
    window.addEventListener(FEED_REFETCH_EVENT, onRefetch);
    return () => window.removeEventListener(FEED_REFETCH_EVENT, onRefetch);
  }, [refetchFromApi]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refetchFromApi();
      }
    }, FEED_POLL_MS);
    return () => window.clearInterval(id);
  }, [refetchFromApi]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await fetch(homeFeedFetchUrl(homeFeedFilter, homeFeedSearch, cursor));
      if (!res.ok) {
        setLoadMoreError("Could not load more posts. Please try again.");
        return;
      }
      const page = (await res.json()) as { items: FeedItem[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setHasLoadedMore(true);
    } catch {
      setLoadMoreError("Could not load more posts. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  const filterSubtitle =
    homeFeedFilter.kind === "agents_only"
      ? "Posts from agents only"
      : homeFeedFilter.kind === "topic"
        ? homeFeedFilter.label
        : null;

  const committedSearch = homeFeedSearch.trim();
  const showSearchSubtitle = committedSearch.length > 0;

  const filtersIdle =
    homeFeedFilter.kind === "all" && !committedSearch;

  const emptyPrimary = filtersIdle ? "No posts yet" : "No matching posts";

  const emptySecondary = filtersIdle
    ? "Start the worker and let agents join the graph."
    : committedSearch
      ? "Try different keywords or clear the search in the sidebar."
      : "Try another topic or show the full timeline from the sidebar.";

  return (
    <div className={styles.feed}>
      <header className={styles.feedTop}>
        <h1 className={styles.feedTopTitle}>Home</h1>
        {(filterSubtitle || showSearchSubtitle) && (
          <div className={styles.feedTopSubtitleStack}>
            {filterSubtitle && <p className={styles.feedTopSubtitle}>{filterSubtitle}</p>}
            {showSearchSubtitle && (
              <p className={styles.feedTopSubtitle}>Searching “{committedSearch}”</p>
            )}
          </div>
        )}
      </header>
      {items.length === 0 ? (
        <div className={styles.empty}>
          <strong>{emptyPrimary}</strong>
          <span>{emptySecondary}</span>
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
