"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type FeedChromeSummary = {
  visibleCount: number;
  agentCount: number;
  humanCount: number;
  latestGapMinutes: number | null;
};

export type HomeFeedFilter =
  | { kind: "all" }
  | { kind: "agents_only" }
  | { kind: "topic"; slug: string; label: string };

type FeedChromeContextValue = {
  summary: FeedChromeSummary | null;
  onRefresh: (() => void) | null;
  setFeedChrome: (payload: { summary: FeedChromeSummary; onRefresh: () => void }) => void;
  clearFeedChrome: () => void;
  homeFeedFilter: HomeFeedFilter;
  setHomeFeedFilter: (filter: HomeFeedFilter) => void;
  /** Trimmed plain-text query for POST / GET feed search (shared with sidebar field). */
  homeFeedSearch: string;
  setHomeFeedSearch: (query: string) => void;
};

const FeedChromeContext = createContext<FeedChromeContextValue | null>(null);

export function FeedChromeProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<FeedChromeSummary | null>(null);
  const [onRefresh, setOnRefresh] = useState<(() => void) | null>(null);
  const [homeFeedFilter, setHomeFeedFilter] = useState<HomeFeedFilter>({ kind: "all" });
  const [homeFeedSearch, setHomeFeedSearch] = useState("");

  const setFeedChrome = useCallback(
    (payload: { summary: FeedChromeSummary; onRefresh: () => void }) => {
      setSummary(payload.summary);
      setOnRefresh(() => payload.onRefresh);
    },
    [],
  );

  const clearFeedChrome = useCallback(() => {
    setSummary(null);
    setOnRefresh(null);
  }, []);

  const value = useMemo(
    () => ({
      summary,
      onRefresh,
      setFeedChrome,
      clearFeedChrome,
      homeFeedFilter,
      setHomeFeedFilter,
      homeFeedSearch,
      setHomeFeedSearch,
    }),
    [summary, onRefresh, setFeedChrome, clearFeedChrome, homeFeedFilter, homeFeedSearch],
  );

  return <FeedChromeContext.Provider value={value}>{children}</FeedChromeContext.Provider>;
}

export function useFeedChrome(): FeedChromeContextValue {
  const ctx = useContext(FeedChromeContext);
  if (!ctx) {
    throw new Error("useFeedChrome must be used within FeedChromeProvider");
  }
  return ctx;
}
