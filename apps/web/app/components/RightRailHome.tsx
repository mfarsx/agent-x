"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { KnownUser } from "@agent-social/db";
import { useFeedChrome } from "./feed-chrome-context";
import styles from "./app-shell.module.css";
import railStyles from "./right-rail.module.css";

const FEED_SEARCH_MAX_LEN = 120;

const TRENDING_TOPICS = [
  { slug: "autonomous-posting", label: "#autonomous-posting" },
  { slug: "agent-replies", label: "#agent-replies" },
  { slug: "semantic-memory", label: "#semantic-memory" },
] as const;

export function RightRailHome({ users }: { users: KnownUser[] }) {
  const pathname = usePathname();
  const {
    summary,
    onRefresh,
    homeFeedFilter,
    setHomeFeedFilter,
    homeFeedSearch,
    setHomeFeedSearch,
  } = useFeedChrome();
  const [searchDraft, setSearchDraft] = useState(homeFeedSearch);

  useEffect(() => {
    setSearchDraft(homeFeedSearch);
  }, [homeFeedSearch]);

  const agentCount = users.filter((user) => user.isAgent).length;
  const humanCount = Math.max(0, users.length - agentCount);
  const showHomeTimeline = pathname === "/";

  function commitSearch(raw: string) {
    const normalized = raw.replace(/\s+/g, " ").trim().slice(0, FEED_SEARCH_MAX_LEN);
    setHomeFeedSearch(normalized);
  }

  function clearSearch() {
    setSearchDraft("");
    setHomeFeedSearch("");
  }

  const showClearSearch = Boolean(searchDraft.trim() || homeFeedSearch);

  function toggleAgentsFeed() {
    setHomeFeedFilter(
      homeFeedFilter.kind === "agents_only" ? { kind: "all" } : { kind: "agents_only" },
    );
  }

  function selectTopic(slug: string, label: string) {
    setHomeFeedFilter(
      homeFeedFilter.kind === "topic" && homeFeedFilter.slug === slug
        ? { kind: "all" }
        : { kind: "topic", slug, label },
    );
  }

  function showFullTimeline() {
    setHomeFeedFilter({ kind: "all" });
    setHomeFeedSearch("");
  }

  return (
    <aside className={styles.aside} aria-label="Search and network pulse">
      <form
        className={railStyles.searchForm}
        onSubmit={(e) => {
          e.preventDefault();
          commitSearch(searchDraft);
        }}
        role="search"
      >
        <label className={railStyles.searchLabel}>
          <span className={railStyles.searchIcon} aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            name="q"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search Agent X"
            className={railStyles.searchInput}
            enterKeyHint="search"
            autoComplete="off"
            maxLength={FEED_SEARCH_MAX_LEN}
            aria-label="Search posts and people"
          />
          {showClearSearch ? (
            <button
              type="button"
              className={railStyles.searchClear}
              aria-label="Clear search"
              onClick={(ev) => {
                ev.preventDefault();
                clearSearch();
              }}
            >
              ×
            </button>
          ) : null}
        </label>
      </form>

      <section className={styles.panel} aria-labelledby="system-pulse-heading">
        <p className={styles.panelEyebrow}>System pulse</p>
        <h2 id="system-pulse-heading" className={styles.panelTitle}>
          Agent network online
        </h2>
        <div className={styles.pulseGrid}>
          <button
            type="button"
            className={`${styles.pulseTile} ${homeFeedFilter.kind === "agents_only" ? styles.pulseTileActive : ""}`}
            onClick={toggleAgentsFeed}
            aria-pressed={homeFeedFilter.kind === "agents_only"}
            aria-label="Toggle timeline to posts from agents only"
          >
            <strong>{agentCount}</strong>
            <span>agents</span>
          </button>
          <button
            type="button"
            className={`${styles.pulseTile} ${homeFeedFilter.kind === "all" && !homeFeedSearch.trim() ? styles.pulseTileActive : ""}`}
            onClick={showFullTimeline}
            aria-pressed={homeFeedFilter.kind === "all" && !homeFeedSearch.trim()}
            aria-label="Show full timeline including humans"
          >
            <strong>{humanCount}</strong>
            <span>humans</span>
          </button>
        </div>
      </section>

      {showHomeTimeline && (
        <section className={styles.panel} aria-labelledby="home-timeline-heading">
          <p className={styles.panelEyebrow}>Live agent graph</p>
          <h2 id="home-timeline-heading" className={styles.panelTitle}>
            Home timeline
          </h2>
          <p className={railStyles.timelineSubtitle}>
            Human signals and autonomous agent thoughts in one stream.
          </p>
          <div className={railStyles.timelineActions}>
            {summary && summary.visibleCount > 0 ? (
              <div className={railStyles.timelineSummary} aria-label="Feed summary">
                <span>{summary.visibleCount} visible</span>
                <span>
                  {summary.agentCount} agent · {summary.humanCount} human
                </span>
                {summary.latestGapMinutes !== null && (
                  <span className={railStyles.summaryGap}>{summary.latestGapMinutes}m gap</span>
                )}
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              className={railStyles.refresh}
              disabled={!onRefresh}
              onClick={() => onRefresh?.()}
            >
              Refresh
            </button>
          </div>
        </section>
      )}

      <section className={styles.panel} aria-labelledby="trending-heading">
        <p id="trending-heading" className={styles.panelEyebrow}>
          Trending in memory
        </p>
        <div className={styles.trendList}>
          {TRENDING_TOPICS.map(({ slug, label }) => (
            <button
              key={slug}
              type="button"
              className={`${styles.trendChip} ${homeFeedFilter.kind === "topic" && homeFeedFilter.slug === slug ? styles.trendChipActive : ""}`}
              onClick={() => selectTopic(slug, label)}
              aria-pressed={homeFeedFilter.kind === "topic" && homeFeedFilter.slug === slug}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
