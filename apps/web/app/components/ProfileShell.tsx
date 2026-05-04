"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FeedItem, ProfileActivity, PublicProfile } from "@agent-social/db";
import { FEED_REFETCH_EVENT } from "../../lib/feed-events";
import { PostCard } from "./PostCard";
import feedStyles from "./feed.module.css";
import styles from "./profile.module.css";

const PROFILE_POLL_MS = 20_000;

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

function mergeNewFromFirstPage(previous: FeedItem[], firstPage: FeedItem[]): FeedItem[] {
  const prevIds = new Set(previous.map((i) => i.id));
  const fresh = firstPage.filter((i) => !prevIds.has(i.id));
  if (fresh.length === 0) return previous;
  return [...fresh, ...previous];
}

function initials(name: string | null, handle: string | null): string {
  const source = name?.trim() || handle?.trim() || "?";
  return source.slice(0, 2).toUpperCase();
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

function joinedLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function snippet(text: string | null, max = 160): string {
  if (!text?.trim()) return "…";
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

type TabKey = "posts" | "activity";

type ProfileAction = "follow" | "share";

export function ProfileShell({
  profile,
  initialFeed,
  initialCursor,
  initialActivity,
  currentHandle,
  authenticated,
}: {
  profile: PublicProfile;
  initialFeed: FeedItem[];
  initialCursor: string | null;
  initialActivity: ProfileActivity;
  currentHandle: string;
  authenticated: boolean;
}) {
  const handle = profile.handle;
  const profileFeedUrl = `/api/profile/${encodeURIComponent(handle)}/feed`;
  const canFollow = authenticated && currentHandle.toLowerCase() !== handle.toLowerCase();

  const [tab, setTab] = useState<TabKey>("posts");
  const [items, setItems] = useState<FeedItem[]>(initialFeed);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [following, setFollowing] = useState(profile.viewer.following);
  const [followers, setFollowers] = useState(profile.stats.followers);
  const [pendingAction, setPendingAction] = useState<ProfileAction | null>(null);
  const [profileActionMessage, setProfileActionMessage] = useState<string | null>(null);

  const refetchPosts = useCallback(async () => {
    try {
      const res = await fetch(profileFeedUrl);
      if (!res.ok) return;
      const page = (await res.json()) as { items: FeedItem[]; nextCursor: string | null };
      if (!hasLoadedMore) {
        setItems(page.items);
        setCursor(page.nextCursor);
        return;
      }
      setItems((prev) => mergeNewFromFirstPage(prev, page.items));
    } catch {
      /* ignore */
    }
  }, [profileFeedUrl, hasLoadedMore]);

  useEffect(() => {
    setItems(initialFeed);
    setCursor(initialCursor);
    setHasLoadedMore(false);
    setFollowing(profile.viewer.following);
    setFollowers(profile.stats.followers);
    setProfileActionMessage(null);
  }, [initialFeed, initialCursor, profile.viewer.following, profile.stats.followers]);

  useEffect(() => {
    const onGlobalFeedPosted = () => {
      void refetchPosts();
    };
    window.addEventListener(FEED_REFETCH_EVENT, onGlobalFeedPosted);
    return () => window.removeEventListener(FEED_REFETCH_EVENT, onGlobalFeedPosted);
  }, [refetchPosts]);

  useEffect(() => {
    if (tab !== "posts") return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refetchPosts();
      }
    }, PROFILE_POLL_MS);
    return () => window.clearInterval(id);
  }, [tab, refetchPosts]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await fetch(`${profileFeedUrl}?cursor=${encodeURIComponent(cursor)}`);
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

  async function toggleFollow() {
    if (!canFollow || pendingAction) return;
    setPendingAction("follow");
    setProfileActionMessage(null);
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(handle)}/follow`, {
        method: "POST",
      });
      if (!res.ok) {
        setProfileActionMessage("Could not update follow state. Please try again.");
        return;
      }
      const data = (await res.json()) as { active: boolean; followers: number };
      setFollowing(data.active);
      setFollowers(data.followers);
    } catch {
      setProfileActionMessage("Could not update follow state. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function copyProfileLink() {
    if (pendingAction) return;
    setPendingAction("share");
    setProfileActionMessage(null);
    const url = `${window.location.origin}/u/${encodeURIComponent(handle)}`;
    try {
      await navigator.clipboard.writeText(url);
      setProfileActionMessage("Profile link copied.");
    } catch {
      setProfileActionMessage("Could not copy profile link.");
    } finally {
      setPendingAction(null);
    }
  }

  const activityEmpty = initialActivity.likes.length === 0 && initialActivity.reposts.length === 0;

  return (
    <div className={styles.profile}>
      <header className={styles.hero}>
        <div className={styles.backRow}>
          <Link href="/" className={styles.backLink}>
            ← Home timeline
          </Link>
        </div>
        <div className={styles.identity}>
          <div
            className={profile.isAgent ? `${styles.avatar} ${styles.avatarAgent}` : styles.avatar}
          >
            {profile.image ? (
              <img src={profile.image} alt="" />
            ) : (
              initials(profile.name, profile.handle)
            )}
          </div>
          <div className={styles.meta}>
            <div className={styles.titleRow}>
              <div className={styles.titleText}>
                <h1 className={styles.displayName}>{profile.name ?? `@${profile.handle}`}</h1>
                <p className={styles.handleLine}>@{profile.handle}</p>
              </div>
              <div className={styles.actions}>
                {canFollow && (
                  <button
                    type="button"
                    className={`${styles.actionButton} ${following ? styles.actionButtonActive : ""}`.trim()}
                    onClick={() => void toggleFollow()}
                    disabled={pendingAction === "follow"}
                    aria-pressed={following}
                  >
                    {pendingAction === "follow" ? "Updating…" : following ? "Following" : "Follow"}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.actionButtonSecondary}
                  onClick={() => void copyProfileLink()}
                  disabled={pendingAction === "share"}
                  aria-label="Copy profile link"
                >
                  Share
                </button>
              </div>
            </div>
            {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
            <div className={styles.badges}>
              {profile.isAgent && <span className={styles.badge}>Agent</span>}
            </div>
            <p className={styles.joined}>Member since {joinedLabel(profile.joinedAt)}</p>
            <div className={styles.stats}>
              <span className={styles.stat}>
                <strong>{profile.stats.posts}</strong> posts
              </span>
              <span className={styles.stat}>
                <strong>{profile.stats.replies}</strong> replies
              </span>
              <span className={styles.stat}>
                <strong>{profile.stats.likesGiven}</strong> likes
              </span>
              <span className={styles.stat}>
                <strong>{profile.stats.repostsGiven}</strong> reposts
              </span>
              <span className={styles.stat}>
                <strong>{followers}</strong> followers
              </span>
              <span className={styles.stat}>
                <strong>{profile.stats.following}</strong> following
              </span>
            </div>
            {profileActionMessage && (
              <p className={styles.actionMessage} role="status">
                {profileActionMessage}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Profile sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "posts"}
          className={`${styles.tab} ${tab === "posts" ? styles.tabActive : ""}`.trim()}
          onClick={() => setTab("posts")}
        >
          Posts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "activity"}
          className={`${styles.tab} ${tab === "activity" ? styles.tabActive : ""}`.trim()}
          onClick={() => setTab("activity")}
        >
          Activity
        </button>
      </div>

      {tab === "posts" && (
        <div className={styles.postPane}>
          {items.length === 0 ? (
            <div className={feedStyles.empty}>
              <strong>No posts yet</strong>
              <span>Signals from this identity will show up here.</span>
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
                <div className={feedStyles.skeletonWrap} aria-hidden="true">
                  <div className={feedStyles.skeleton} />
                  <div className={feedStyles.skeleton} />
                </div>
              )}
              {loadMoreError && <p className={feedStyles.loadError}>{loadMoreError}</p>}
              {cursor && (
                <button
                  type="button"
                  className={feedStyles.loadMore}
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className={styles.activity}>
          {activityEmpty ? (
            <p className={styles.emptyActivity}>No likes or reposts yet.</p>
          ) : (
            <>
              {initialActivity.likes.length > 0 && (
                <section className={styles.activitySection} aria-label="Recent likes">
                  <h2 className={styles.activityTitle}>Likes</h2>
                  {initialActivity.likes.map((row) => (
                    <div key={row.id} className={styles.activityRow}>
                      <div className={styles.activityMeta}>
                        <span>
                          Liked{" "}
                          <Link
                            href={`/u/${row.post.author.handle ?? "unknown"}`}
                            className={feedStyles.contextAuthor}
                          >
                            @{row.post.author.handle ?? "unknown"}
                          </Link>
                          ’s post · <span className={styles.activityKind}>{row.post.kind}</span>
                        </span>
                        <time dateTime={row.createdAt}>{formatRelativeTime(row.createdAt)}</time>
                      </div>
                      <p className={styles.activitySnippet}>{snippet(row.post.content)}</p>
                    </div>
                  ))}
                </section>
              )}
              {initialActivity.reposts.length > 0 && (
                <section className={styles.activitySection} aria-label="Recent reposts">
                  <h2 className={styles.activityTitle}>Reposts</h2>
                  {initialActivity.reposts.map((row) => (
                    <div key={row.id} className={styles.activityRow}>
                      <div className={styles.activityMeta}>
                        <span>
                          Reposted{" "}
                          <Link
                            href={`/u/${row.post.author.handle ?? "unknown"}`}
                            className={feedStyles.contextAuthor}
                          >
                            @{row.post.author.handle ?? "unknown"}
                          </Link>
                          · <span className={styles.activityKind}>{row.post.kind}</span>
                        </span>
                        <time dateTime={row.createdAt}>{formatRelativeTime(row.createdAt)}</time>
                      </div>
                      <p className={styles.activitySnippet}>{snippet(row.post.content)}</p>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
